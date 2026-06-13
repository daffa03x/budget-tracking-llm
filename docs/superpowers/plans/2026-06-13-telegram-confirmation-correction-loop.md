# Telegram Bot Confirmation & Correction Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button-driven confirmation/correction layer to the Telegram bot — high-confidence parses save immediately with undo/edit buttons; low-confidence AI/photo parses preview first and save only on tap; category/pocket/amount are correctable inline.

**Architecture:** Each interactive bot message is identified by its own `message_id`; its context lives in a `TelegramInteraction` row keyed by `(chatId, messageId)`. `callback_data` carries only `action[:arg]` (≤64 bytes). A new `callbacks.ts` handles `callback_query` updates and a new `keyboards.ts` builds inline keyboards; `handler.ts` stays thin.

**Tech Stack:** Next.js 16 App Router (route handler), Prisma 7 (PostgreSQL), Vitest, Telegram Bot API (inline keyboards + `callback_query` + `force_reply`).

---

## File Structure

- `prisma/schema.prisma` — add `TelegramInteractionKind`, `TelegramPendingField` enums + `TelegramInteraction` model (modify).
- `prisma/migrations/20260613100000_add_telegram_interaction/migration.sql` — new migration (create).
- `lib/telegram/types.ts` — add `callback_query`, `reply_to_message`, inline-keyboard types (modify).
- `lib/telegram/api.ts` — `reply_markup` on `sendMessage`; add `editMessageText`, `answerCallbackQuery`, `sendForceReply` (modify).
- `lib/telegram/callbacks.ts` — `callback_data` codec + `handleCallbackQuery` (create).
- `lib/telegram/keyboards.ts` — pure inline-keyboard builders (create).
- `lib/services/telegram.service.ts` — interaction CRUD + ownership-checked transaction update/delete + category/pocket listing (modify).
- `lib/telegram/handler.ts` — attach keyboards on save; AI/photo paths create drafts; amount-reply routing (modify).
- `app/api/telegram/webhook/route.ts` — route `callback_query` updates (modify).
- Tests: `lib/telegram/__tests__/callbacks.test.ts`, `lib/telegram/__tests__/keyboards.test.ts`, `lib/services/__tests__/telegram.service.test.ts` (create).

**Conventions to follow (from existing code):**
- Prisma mocked in tests via `vi.mock("@/lib/prisma", ...)` (see `lib/telegram/__tests__/resolver.test.ts`).
- Ownership: every transaction read/update/delete filters by `userId` derived from `getLinkedUserId(chatId)`.
- Expense changes call `syncBudgetsForExpenseChange(userId, [{ type, categoryId, date }])` (see `lib/telegram/report.ts:160`).
- Decimal amounts stored as `amount.toFixed(2)` (see `lib/services/telegram.service.ts:23`).

---

## Task 1: Schema — `TelegramInteraction` model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260613100000_add_telegram_interaction/migration.sql`

- [ ] **Step 1: Add enums + model to `prisma/schema.prisma`**

Insert after the `TelegramProcessedUpdate` model:

```prisma
enum TelegramInteractionKind {
  draft
  saved
}

enum TelegramPendingField {
  none
  amount
}

// Context for an interactive (button-bearing) bot message, keyed by the
// message's own message_id. draft = previewed but not yet saved; saved = a
// real Transaction the buttons can undo/edit.
model TelegramInteraction {
  id              String                  @id @default(cuid())
  chatId          String
  messageId       Int
  userId          String
  kind            TelegramInteractionKind
  source          TransactionSource       @default(text)
  transactionId   String?
  payload         Json?
  pendingField    TelegramPendingField    @default(none)
  promptMessageId Int?
  expiresAt       DateTime
  createdAt       DateTime                @default(now())

  @@unique([chatId, messageId])
  @@index([expiresAt])
}
```

Note: `promptMessageId` stores the `message_id` of the `force_reply` prompt sent during amount editing, so a user's reply can be matched back to this interaction via `reply_to_message`.

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20260613100000_add_telegram_interaction/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "TelegramInteractionKind" AS ENUM ('draft', 'saved');

-- CreateEnum
CREATE TYPE "TelegramPendingField" AS ENUM ('none', 'amount');

-- CreateTable
CREATE TABLE "TelegramInteraction" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TelegramInteractionKind" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'text',
    "transactionId" TEXT,
    "payload" JSONB,
    "pendingField" "TelegramPendingField" NOT NULL DEFAULT 'none',
    "promptMessageId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramInteraction_chatId_messageId_key" ON "TelegramInteraction"("chatId", "messageId");

-- CreateIndex
CREATE INDEX "TelegramInteraction_expiresAt_idx" ON "TelegramInteraction"("expiresAt");
```

Note: `TransactionSource` already exists (created by an earlier migration), so the SQL references it without a `CREATE TYPE`.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Apply the migration**

Run: `npx prisma migrate deploy`
Expected: `Applying migration 20260613100000_add_telegram_interaction` then `All migrations have been successfully applied.`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260613100000_add_telegram_interaction
git commit -m "feat: add TelegramInteraction model for bot confirmation loop"
```

---

## Task 2: `callback_data` codec

**Files:**
- Create: `lib/telegram/callbacks.ts`
- Test: `lib/telegram/__tests__/callbacks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/telegram/__tests__/callbacks.test.ts`:

```ts
// lib/telegram/__tests__/callbacks.test.ts
import { describe, it, expect } from "vitest";
import { encodeCallback, decodeCallback, type Callback } from "../callbacks";

describe("callback codec", () => {
  const cases: Callback[] = [
    { kind: "save" },
    { kind: "cancel" },
    { kind: "catMenu" },
    { kind: "catPick", id: "cl0123456789abcdefghijklmn" },
    { kind: "pktMenu" },
    { kind: "pktPick", id: "cl0123456789abcdefghijklmn" },
    { kind: "amt" },
    { kind: "back" },
  ];

  it("round-trips every callback and stays within 64 bytes", () => {
    for (const cb of cases) {
      const data = encodeCallback(cb);
      expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
      expect(decodeCallback(data)).toEqual(cb);
    }
  });

  it("returns null for unknown data", () => {
    expect(decodeCallback("bogus")).toBeNull();
    expect(decodeCallback("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/telegram/__tests__/callbacks.test.ts`
Expected: FAIL — cannot find module `../callbacks`.

- [ ] **Step 3: Write the codec**

Create `lib/telegram/callbacks.ts`:

```ts
// lib/telegram/callbacks.ts
export type Callback =
  | { kind: "save" }
  | { kind: "cancel" }
  | { kind: "catMenu" }
  | { kind: "catPick"; id: string }
  | { kind: "pktMenu" }
  | { kind: "pktPick"; id: string }
  | { kind: "amt" }
  | { kind: "back" };

export function encodeCallback(cb: Callback): string {
  switch (cb.kind) {
    case "save": return "save";
    case "cancel": return "cancel";
    case "catMenu": return "cat";
    case "catPick": return `cat:${cb.id}`;
    case "pktMenu": return "pkt";
    case "pktPick": return `pkt:${cb.id}`;
    case "amt": return "amt";
    case "back": return "back";
  }
}

export function decodeCallback(data: string): Callback | null {
  const sep = data.indexOf(":");
  const prefix = sep === -1 ? data : data.slice(0, sep);
  const arg = sep === -1 ? "" : data.slice(sep + 1);

  switch (prefix) {
    case "save": return { kind: "save" };
    case "cancel": return { kind: "cancel" };
    case "cat": return arg ? { kind: "catPick", id: arg } : { kind: "catMenu" };
    case "pkt": return arg ? { kind: "pktPick", id: arg } : { kind: "pktMenu" };
    case "amt": return { kind: "amt" };
    case "back": return { kind: "back" };
    default: return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/telegram/__tests__/callbacks.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/callbacks.ts lib/telegram/__tests__/callbacks.test.ts
git commit -m "feat: add telegram callback_data codec"
```

---

## Task 3: Inline keyboard builders

**Files:**
- Create: `lib/telegram/keyboards.ts`
- Test: `lib/telegram/__tests__/keyboards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/telegram/__tests__/keyboards.test.ts`:

```ts
// lib/telegram/__tests__/keyboards.test.ts
import { describe, it, expect } from "vitest";
import {
  savedConfirmKeyboard,
  draftConfirmKeyboard,
  draftSaveOnlyKeyboard,
  categoryPickerKeyboard,
  pocketPickerKeyboard,
} from "../keyboards";

function callbackData(kb: { inline_keyboard: { callback_data: string }[][] }): string[] {
  return kb.inline_keyboard.flat().map((b) => b.callback_data);
}

describe("keyboards", () => {
  it("saved confirm keyboard has cancel/cat/pkt/amt", () => {
    expect(callbackData(savedConfirmKeyboard())).toEqual(["cancel", "cat", "pkt", "amt"]);
  });

  it("draft confirm keyboard has save/cancel/cat/pkt/amt", () => {
    expect(callbackData(draftConfirmKeyboard())).toEqual(["save", "cancel", "cat", "pkt", "amt"]);
  });

  it("save-only draft keyboard has just save/cancel (multi-item drafts)", () => {
    expect(callbackData(draftSaveOnlyKeyboard())).toEqual(["save", "cancel"]);
  });

  it("category picker builds one button per category plus back", () => {
    const kb = categoryPickerKeyboard([
      { id: "a", name: "Makan" },
      { id: "b", name: "Transport" },
    ]);
    expect(callbackData(kb)).toEqual(["cat:a", "cat:b", "back"]);
  });

  it("pocket picker builds one button per pocket plus back", () => {
    const kb = pocketPickerKeyboard([{ id: "p1", name: "BCA" }]);
    expect(callbackData(kb)).toEqual(["pkt:p1", "back"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/telegram/__tests__/keyboards.test.ts`
Expected: FAIL — cannot find module `../keyboards`.

- [ ] **Step 3: Write the builders**

Create `lib/telegram/keyboards.ts`:

```ts
// lib/telegram/keyboards.ts
import { encodeCallback } from "./callbacks";

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export function savedConfirmKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "↩️ Batal", callback_data: encodeCallback({ kind: "cancel" }) },
        { text: "✏️ Kategori", callback_data: encodeCallback({ kind: "catMenu" }) },
        { text: "💼 Kantong", callback_data: encodeCallback({ kind: "pktMenu" }) },
        { text: "💵 Nominal", callback_data: encodeCallback({ kind: "amt" }) },
      ],
    ],
  };
}

export function draftConfirmKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Simpan", callback_data: encodeCallback({ kind: "save" }) },
        { text: "❌ Batal", callback_data: encodeCallback({ kind: "cancel" }) },
      ],
      [
        { text: "✏️ Kategori", callback_data: encodeCallback({ kind: "catMenu" }) },
        { text: "💼 Kantong", callback_data: encodeCallback({ kind: "pktMenu" }) },
        { text: "💵 Nominal", callback_data: encodeCallback({ kind: "amt" }) },
      ],
    ],
  };
}

// Multi-item drafts (multi-receipt photos) only support save/cancel — per-item
// editing is out of scope (see spec non-goals).
export function draftSaveOnlyKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Simpan", callback_data: encodeCallback({ kind: "save" }) },
        { text: "❌ Batal", callback_data: encodeCallback({ kind: "cancel" }) },
      ],
    ],
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function categoryPickerKeyboard(
  categories: { id: string; name: string }[],
): InlineKeyboard {
  const buttons: InlineButton[] = categories.map((c) => ({
    text: c.name,
    callback_data: encodeCallback({ kind: "catPick", id: c.id }),
  }));
  const rows = chunk(buttons, 2);
  rows.push([{ text: "⬅️ Kembali", callback_data: encodeCallback({ kind: "back" }) }]);
  return { inline_keyboard: rows };
}

export function pocketPickerKeyboard(
  pockets: { id: string; name: string }[],
): InlineKeyboard {
  const buttons: InlineButton[] = pockets.map((p) => ({
    text: p.name,
    callback_data: encodeCallback({ kind: "pktPick", id: p.id }),
  }));
  const rows = chunk(buttons, 2);
  rows.push([{ text: "⬅️ Kembali", callback_data: encodeCallback({ kind: "back" }) }]);
  return { inline_keyboard: rows };
}
```

Note: the picker tests above pass `flat()`-tened arrays, so 2-per-row chunking does not change the flattened `callback_data` order. The `categoryPickerKeyboard([a,b])` flattened order is `["cat:a","cat:b","back"]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/telegram/__tests__/keyboards.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/keyboards.ts lib/telegram/__tests__/keyboards.test.ts
git commit -m "feat: add telegram inline keyboard builders"
```

---

## Task 4: Telegram API helpers (reply_markup, edit, answer, force_reply)

**Files:**
- Modify: `lib/telegram/api.ts`
- Modify: `lib/telegram/types.ts`

These are thin `fetch` wrappers with no unit test (network side-effects), consistent with the existing `api.ts`. Verification is by type-check/build.

- [ ] **Step 1: Add keyboard/callback types to `lib/telegram/types.ts`**

Append to `lib/telegram/types.ts`:

```ts
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramFrom;
  message?: TelegramMessage;
  data?: string;
};
```

And extend `TelegramMessage` to include a reply reference and `message_id` typing already present. Add the field inside the existing `TelegramMessage` type definition:

```ts
  reply_to_message?: TelegramMessage;
```

And extend `TelegramUpdate`:

```ts
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};
```

(Replace the existing `TelegramUpdate` definition with this one.)

- [ ] **Step 2: Add `reply_markup` support + new helpers to `lib/telegram/api.ts`**

The existing `sendMessage` already spreads `options`, so `reply_markup` can be passed via `options`. Add three new functions at the end of `lib/telegram/api.ts`:

```ts
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  const res = await fetch(`${BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      ...options,
    }),
  });
  if (!res.ok) {
    console.error(`[Telegram] editMessageText failed: ${res.status} ${await res.text()}`);
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const res = await fetch(`${BASE}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  if (!res.ok) {
    console.error(`[Telegram] answerCallbackQuery failed: ${res.status}`);
  }
}

// Sends a message that forces the user's next reply to target it. Returns the
// sent message_id so callers can match the eventual reply back to it.
export async function sendForceReply(chatId: number, text: string): Promise<number | null> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { force_reply: true, input_field_placeholder: "Nominal baru, mis. 50rb" },
    }),
  });
  if (!res.ok) {
    console.error(`[Telegram] sendForceReply failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as { result?: { message_id?: number } };
  return data.result?.message_id ?? null;
}
```

- [ ] **Step 3: Update `sendMessage` to return its `message_id`**

The confirmation flow needs the sent message's `message_id` to key the interaction row. Change `sendMessage` in `lib/telegram/api.ts` from returning `void` to returning `number | null`:

```ts
export async function sendMessage(
  chatId: number,
  text: string,
  options: Record<string, unknown> = {},
): Promise<number | null> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...options }),
  });
  if (!res.ok) {
    console.error(`[Telegram] sendMessage failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as { result?: { message_id?: number } };
  return data.result?.message_id ?? null;
}
```

This is backward-compatible: existing `await sendMessage(...)` callers ignore the return value.

- [ ] **Step 4: Verify type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/telegram/api.ts lib/telegram/types.ts
git commit -m "feat: add telegram edit/answer/force_reply api helpers"
```

---

## Task 5: Service — interaction CRUD + ownership-checked transaction edits

**Files:**
- Modify: `lib/services/telegram.service.ts`
- Test: `lib/services/__tests__/telegram.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/services/__tests__/telegram.service.test.ts`:

```ts
// lib/services/__tests__/telegram.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { findMany: vi.fn() },
    pocket: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/budget.service", () => ({
  syncBudgetsForExpenseChange: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";
import {
  updateTransactionAmount,
  deleteTransactionById,
  listCategoriesForUser,
} from "../telegram.service";

describe("updateTransactionAmount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the transaction is not owned by the user", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
    const ok = await updateTransactionAmount("user-1", "txn-1", 75000);
    expect(ok).toBe(false);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it("updates amount and re-syncs budgets for an owned expense", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
      id: "txn-1",
      type: "expense",
      categoryId: "cat-1",
      date: new Date("2026-06-13"),
    } as never);
    const ok = await updateTransactionAmount("user-1", "txn-1", 75000);
    expect(ok).toBe(true);
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { amount: "75000.00" },
    });
    expect(syncBudgetsForExpenseChange).toHaveBeenCalledWith("user-1", [
      { type: "expense", categoryId: "cat-1", date: new Date("2026-06-13") },
    ]);
  });
});

describe("deleteTransactionById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false for an unowned transaction", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
    expect(await deleteTransactionById("user-1", "txn-x")).toBe(false);
    expect(prisma.transaction.delete).not.toHaveBeenCalled();
  });

  it("deletes an owned transaction", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
      id: "txn-1",
      type: "income",
      categoryId: "cat-1",
      date: new Date("2026-06-13"),
    } as never);
    expect(await deleteTransactionById("user-1", "txn-1")).toBe(true);
    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: "txn-1" } });
  });
});

describe("listCategoriesForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user categories for a type", async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValueOnce([
      { id: "c1", name: "Makan" },
    ] as never);
    const cats = await listCategoriesForUser("user-1", "expense");
    expect(cats).toEqual([{ id: "c1", name: "Makan" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/__tests__/telegram.service.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement the service functions**

Add to `lib/services/telegram.service.ts` (after `getLinkedUserId`). Keep the existing imports; they already include `prisma` and `syncBudgetsForExpenseChange`:

```ts
type OwnedTxn = {
  id: string;
  type: "income" | "expense";
  categoryId: string | null;
  date: Date;
};

async function findOwnedTransaction(userId: string, transactionId: string): Promise<OwnedTxn | null> {
  return prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, type: true, categoryId: true, date: true },
  });
}

async function resyncExpense(userId: string, txn: OwnedTxn): Promise<void> {
  if (txn.type === "expense") {
    await syncBudgetsForExpenseChange(userId, [
      { type: txn.type, categoryId: txn.categoryId, date: txn.date },
    ]);
  }
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.update({ where: { id: transactionId }, data: { categoryId } });
  await resyncExpense(userId, txn); // old category
  await resyncExpense(userId, { ...txn, categoryId }); // new category
  return true;
}

export async function updateTransactionPocket(
  userId: string,
  transactionId: string,
  pocketId: string,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.update({ where: { id: transactionId }, data: { pocketId } });
  return true;
}

export async function updateTransactionAmount(
  userId: string,
  transactionId: string,
  amount: number,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { amount: amount.toFixed(2) },
  });
  await resyncExpense(userId, txn);
  return true;
}

export async function deleteTransactionById(
  userId: string,
  transactionId: string,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.delete({ where: { id: transactionId } });
  await resyncExpense(userId, txn);
  return true;
}

export async function listCategoriesForUser(
  userId: string,
  type: "income" | "expense",
): Promise<{ id: string; name: string }[]> {
  return prisma.category.findMany({
    where: {
      OR: [
        { userId, type: { in: [type, "both"] } },
        { userId: null, isDefault: true, type: { in: [type, "both"] } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export async function listPocketsForUser(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return prisma.pocket.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/__tests__/telegram.service.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/telegram.service.ts lib/services/__tests__/telegram.service.test.ts
git commit -m "feat: add ownership-checked transaction edits + category/pocket listing"
```

---

## Task 6: Service — interaction row CRUD

**Files:**
- Modify: `lib/services/telegram.service.ts`
- Test: `lib/services/__tests__/telegram.service.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `lib/services/__tests__/telegram.service.test.ts`. First extend the prisma mock object at the top of the file to add `telegramInteraction`:

```ts
    telegramInteraction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
```

Then add the import and tests:

```ts
import {
  createInteraction,
  getInteraction,
  findInteractionByPrompt,
} from "../telegram.service";

describe("createInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a draft interaction with payload + expiry", async () => {
    vi.mocked(prisma.telegramInteraction.create).mockResolvedValueOnce({ id: "i1" } as never);
    await createInteraction({
      chatId: "123",
      messageId: 55,
      userId: "user-1",
      kind: "draft",
      source: "image",
      payload: [{ type: "expense", amount: 50000, category: "Makan", pocketName: null }],
    });
    const arg = vi.mocked(prisma.telegramInteraction.create).mock.calls[0][0] as {
      data: { chatId: string; messageId: number; kind: string; expiresAt: Date };
    };
    expect(arg.data.chatId).toBe("123");
    expect(arg.data.messageId).toBe(55);
    expect(arg.data.kind).toBe("draft");
    expect(arg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("getInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for an expired interaction", async () => {
    vi.mocked(prisma.telegramInteraction.findUnique).mockResolvedValueOnce({
      id: "i1",
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    expect(await getInteraction("123", 55)).toBeNull();
  });

  it("returns a live interaction", async () => {
    const live = { id: "i1", expiresAt: new Date(Date.now() + 60000), kind: "draft" };
    vi.mocked(prisma.telegramInteraction.findUnique).mockResolvedValueOnce(live as never);
    expect(await getInteraction("123", 55)).toEqual(live);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/__tests__/telegram.service.test.ts`
Expected: FAIL — `createInteraction`/`getInteraction`/`findInteractionByPrompt` not found.

- [ ] **Step 3: Implement interaction CRUD**

Add to `lib/services/telegram.service.ts`:

```ts
import type { Prisma, TelegramInteraction } from "@/lib/generated/prisma/client";

const INTERACTION_TTL_MS = 60 * 60 * 1000; // 1 hour

export type DraftItem = {
  type: "income" | "expense";
  amount: number;
  category: string;
  pocketName: string | null;
};

export async function createInteraction(input: {
  chatId: string;
  messageId: number;
  userId: string;
  kind: "draft" | "saved";
  source: "text" | "voice" | "image";
  transactionId?: string | null;
  payload?: DraftItem[] | null;
}): Promise<void> {
  await prisma.telegramInteraction.create({
    data: {
      chatId: input.chatId,
      messageId: input.messageId,
      userId: input.userId,
      kind: input.kind,
      source: input.source,
      transactionId: input.transactionId ?? null,
      payload: (input.payload ?? null) as Prisma.InputJsonValue | undefined,
      expiresAt: new Date(Date.now() + INTERACTION_TTL_MS),
    },
  });
}

// Updates a draft's stored payload after an inline edit (single-item drafts).
export async function updateInteractionPayload(
  chatId: string,
  messageId: number,
  payload: DraftItem[],
): Promise<void> {
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { payload: payload as unknown as Prisma.InputJsonValue },
  });
}

// Resolves a category/pocket id back to its display name so draft payloads
// (which store names, not ids) stay correct after an inline pick.
export async function getCategoryName(userId: string, categoryId: string): Promise<string | null> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null, isDefault: true }] },
    select: { name: true },
  });
  return cat?.name ?? null;
}

export async function getPocketName(userId: string, pocketId: string): Promise<string | null> {
  const pocket = await prisma.pocket.findFirst({
    where: { id: pocketId, userId },
    select: { name: true },
  });
  return pocket?.name ?? null;
}

export async function getInteraction(
  chatId: string,
  messageId: number,
): Promise<TelegramInteraction | null> {
  const row = await prisma.telegramInteraction.findUnique({
    where: { chatId_messageId: { chatId, messageId } },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function setInteractionTransaction(
  chatId: string,
  messageId: number,
  transactionId: string,
): Promise<void> {
  // Keep payload so the category picker can still read the transaction type.
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { kind: "saved", transactionId },
  });
}

export async function setInteractionPendingAmount(
  chatId: string,
  messageId: number,
  promptMessageId: number,
): Promise<void> {
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { pendingField: "amount", promptMessageId },
  });
}

export async function clearInteractionPending(
  chatId: string,
  messageId: number,
): Promise<void> {
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { pendingField: "none", promptMessageId: null },
  });
}

export async function deleteInteraction(chatId: string, messageId: number): Promise<void> {
  await prisma.telegramInteraction
    .delete({ where: { chatId_messageId: { chatId, messageId } } })
    .catch(() => {});
}

// Finds the interaction whose force_reply prompt the user replied to.
export async function findInteractionByPrompt(
  chatId: string,
  promptMessageId: number,
): Promise<TelegramInteraction | null> {
  const row = await prisma.telegramInteraction.findFirst({
    where: { chatId, promptMessageId, pendingField: "amount" },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/__tests__/telegram.service.test.ts`
Expected: PASS (all interaction + edit tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/telegram.service.ts lib/services/__tests__/telegram.service.test.ts
git commit -m "feat: add telegram interaction row CRUD"
```

---

## Task 7: Wire confirmation keyboards into the save paths

**Files:**
- Modify: `lib/telegram/handler.ts`

`createTransactionFromBot` currently returns `{ id, amount, type, category }` (see `lib/services/telegram.service.ts:34`), so the saved path already has the transaction id.

- [ ] **Step 1: Update imports in `lib/telegram/handler.ts`**

Add to the existing imports:

```ts
import { sendMessage, sendChatAction, downloadFile, editMessageText, answerCallbackQuery, sendForceReply } from "./api";
import { savedConfirmKeyboard, draftConfirmKeyboard, draftSaveOnlyKeyboard } from "./keyboards";
import {
  createTransactionFromBot,
  getLinkedUserId,
  createInteraction,
  type DraftItem,
} from "@/lib/services/telegram.service";
```

(Merge with the existing `./api` and `@/lib/services/telegram.service` import lines rather than duplicating them. `editMessageText`/`answerCallbackQuery`/`sendForceReply` are used in Task 9; importing now is harmless but you may add them in Task 9 instead.)

- [ ] **Step 2: Attach the saved keyboard in `saveAndConfirm`**

Replace the final `await sendMessage(...)` call in `saveAndConfirm` so it captures the transaction id and sends the keyboard, then records a `saved` interaction:

```ts
  const created = await createTransactionFromBot({
    type: parsed.type,
    amount: parsed.amount,
    categoryId,
    pocketId,
    source,
    rawInput,
    telegramChatId: chatIdStr,
    userId,
  });

  const typeIcon = parsed.type === "income" ? "💰" : "💸";
  const typeLabel = parsed.type === "income" ? "Pemasukan" : "Pengeluaran";
  const pocketLine = pocketId ? `\n💼 Kantong: ${parsed.pocketName}` : "";
  const date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

  const messageId = await sendMessage(
    chatId,
    `✅ Tercatat!\n\n${typeIcon} ${typeLabel}: ${parsed.category}\n💵 ${formatRupiah(parsed.amount)}${pocketLine}\n📅 ${date}`,
    { reply_markup: savedConfirmKeyboard() },
  );

  if (messageId !== null) {
    await createInteraction({
      chatId: chatIdStr,
      messageId,
      userId,
      kind: "saved",
      source,
      transactionId: created.id,
      payload: [{ type: parsed.type, amount: parsed.amount, category: parsed.category, pocketName: parsed.pocketName }],
    });
  }
```

(Remove the previous standalone `await createTransactionFromBot(...)` and trailing `await sendMessage(...)` in this function so the transaction is created exactly once.)

- [ ] **Step 3: Verify build/lint**

Run: `npm run lint`
Expected: no errors (existing tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add lib/telegram/handler.ts
git commit -m "feat: attach undo/edit keyboard to high-confidence bot saves"
```

---

## Task 8: Draft-preview path for AI text and photos

**Files:**
- Modify: `lib/telegram/handler.ts`

Goal: AI text parse and receipt photos must show a preview with `draftConfirmKeyboard()` and create a `draft` interaction instead of saving.

- [ ] **Step 1: Add a draft helper to `lib/telegram/handler.ts`**

Add this function near `saveAndConfirm`:

```ts
async function previewDraft(
  chatId: number,
  chatIdStr: string,
  userId: string,
  items: DraftItem[],
  headline: string,
  source: "text" | "voice" | "image",
): Promise<void> {
  const lines = [headline, ""];
  let total = 0;
  for (const it of items) {
    const icon = it.type === "income" ? "💰" : "💸";
    lines.push(`${icon} ${it.category} — ${formatRupiah(it.amount)}`);
    total += it.amount;
  }
  if (items.length > 1) {
    lines.push("", `Total: ${formatRupiah(total)} (${items.length} transaksi)`);
  }
  lines.push("", "Simpan transaksi ini?");

  // Single-item drafts get the full edit toolkit; multi-item drafts (multi-
  // receipt photos) only get save/cancel (per-item editing is out of scope).
  const keyboard = items.length === 1 ? draftConfirmKeyboard() : draftSaveOnlyKeyboard();

  const messageId = await sendMessage(chatId, lines.join("\n"), { reply_markup: keyboard });
  if (messageId !== null) {
    await createInteraction({
      chatId: chatIdStr,
      messageId,
      userId,
      kind: "draft",
      source,
      payload: items,
    });
  }
}
```

- [ ] **Step 2: Route the AI text fallback through the draft preview**

In `handleText`, replace the LLM success branch so it previews instead of saving:

```ts
  try {
    const llmResult = await extractTransactionFromText(text);
    if (llmResult) {
      await previewDraft(chatId, chatIdStr, userId, [
        { type: llmResult.type, amount: llmResult.amount, category: llmResult.category, pocketName: llmResult.pocketName },
      ], "🤖 <b>Saya tangkap transaksi ini:</b>", "text");
      return;
    }
  } catch {
    await sendMessage(chatId, "🤖 Layanan AI sedang sibuk. Coba format: pengeluaran [kategori] [nominal]");
    return;
  }
```

- [ ] **Step 3: Route the voice LLM fallback through the draft preview**

In `handleVoice`, replace the `if (llmResult) { await saveAndConfirm(...) }` block with:

```ts
  if (llmResult) {
    await previewDraft(chatId, chatIdStr, userId, [
      { type: llmResult.type, amount: llmResult.amount, category: llmResult.category, pocketName: llmResult.pocketName },
    ], "🎙️ <b>Saya tangkap transaksi ini:</b>", "voice");
    return;
  }
```

(The high-confidence `parseMessage` branch in `handleVoice` still calls `saveAndConfirm` and saves immediately — unchanged.)

- [ ] **Step 4: Replace `handleImage` save loop with a draft preview**

In `handleImage`, after `results` is obtained and the empty check passes, replace the save loop (the `for (const r of results)` block and its summary) with:

```ts
  const items: DraftItem[] = results.map((r) => ({
    type: "expense",
    amount: r.amount,
    category: r.category,
    pocketName: null,
  }));
  await previewDraft(chatId, chatIdStr, userId, items, "📷 <b>Struk terbaca!</b>", "image");
```

- [ ] **Step 5: Verify lint + existing tests**

Run: `npm run lint && npx vitest run lib/telegram`
Expected: lint clean; existing telegram tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/telegram/handler.ts
git commit -m "feat: preview AI/photo transactions before saving (draft flow)"
```

---

## Task 9: Callback query handler

**Files:**
- Modify: `lib/telegram/callbacks.ts`
- Modify: `lib/telegram/handler.ts`

This wires button taps to actions. It coordinates services already built; no new unit test (it is integration glue over tested units), verified via lint/build and manual run. The pure codec in `callbacks.ts` is already tested.

- [ ] **Step 1: Add `handleCallbackQuery` to `lib/telegram/callbacks.ts`**

Append to `lib/telegram/callbacks.ts`:

```ts
import { editMessageText, answerCallbackQuery, sendForceReply } from "./api";
import {
  savedConfirmKeyboard,
  draftConfirmKeyboard,
  categoryPickerKeyboard,
  pocketPickerKeyboard,
} from "./keyboards";
import { resolveCategory, resolvePocket } from "./resolver";
import { formatRupiah } from "./parser";
import { createTransactionFromBot } from "@/lib/services/telegram.service";
import {
  getInteraction,
  deleteInteraction,
  setInteractionTransaction,
  setInteractionPendingAmount,
  updateInteractionPayload,
  getCategoryName,
  getPocketName,
  listCategoriesForUser,
  listPocketsForUser,
  updateTransactionCategory,
  updateTransactionPocket,
  deleteTransactionById,
  type DraftItem,
} from "@/lib/services/telegram.service";
import type { TelegramCallbackQuery } from "./types";

function renderSaved(items: DraftItem[]): string {
  const lines = ["✅ <b>Tersimpan!</b>", ""];
  let total = 0;
  for (const it of items) {
    const icon = it.type === "income" ? "💰" : "💸";
    lines.push(`${icon} ${it.category} — ${formatRupiah(it.amount)}`);
    total += it.amount;
  }
  if (items.length > 1) lines.push("", `Total: ${formatRupiah(total)}`);
  return lines.join("\n");
}

export async function handleCallbackQuery(cb: TelegramCallbackQuery): Promise<void> {
  const message = cb.message;
  if (!message || !cb.data) {
    await answerCallbackQuery(cb.id);
    return;
  }
  const chatId = message.chat.id;
  const chatIdStr = String(chatId);
  const messageId = message.message_id;

  const decoded = decodeCallback(cb.data);
  const interaction = await getInteraction(chatIdStr, messageId);

  if (!decoded || !interaction) {
    await answerCallbackQuery(cb.id, "Sesi sudah berakhir. Kirim ulang transaksinya.");
    await editMessageText(chatId, messageId, message.text ?? "Sesi berakhir.", {});
    return;
  }

  const userId = interaction.userId;
  const items = (interaction.payload as DraftItem[] | null) ?? [];

  switch (decoded.kind) {
    case "save": {
      if (interaction.kind !== "draft") { await answerCallbackQuery(cb.id, "Sudah tersimpan."); return; }
      for (const it of items) {
        const categoryId = await resolveCategory(userId, it.category, it.type);
        const pocketId = it.pocketName ? await resolvePocket(userId, it.pocketName) : null;
        const created = await createTransactionFromBot({
          type: it.type, amount: it.amount, categoryId, pocketId,
          source: interaction.source, rawInput: null, telegramChatId: chatIdStr, userId,
        });
        if (items.length === 1) await setInteractionTransaction(chatIdStr, messageId, created.id);
      }
      if (items.length > 1) await deleteInteraction(chatIdStr, messageId);
      await editMessageText(chatId, messageId, renderSaved(items), {
        reply_markup: items.length === 1 ? savedConfirmKeyboard() : undefined,
      });
      await answerCallbackQuery(cb.id, "Tersimpan ✅");
      return;
    }

    case "cancel": {
      if (interaction.kind === "saved" && interaction.transactionId) {
        await deleteTransactionById(userId, interaction.transactionId);
      }
      await deleteInteraction(chatIdStr, messageId);
      await editMessageText(chatId, messageId, "❌ Dibatalkan.", {});
      await answerCallbackQuery(cb.id, "Dibatalkan");
      return;
    }

    case "catMenu": {
      const type = items[0]?.type ?? "expense";
      const cats = await listCategoriesForUser(userId, type);
      await editMessageText(chatId, messageId, message.text ?? "Pilih kategori:", {
        reply_markup: categoryPickerKeyboard(cats),
      });
      await answerCallbackQuery(cb.id);
      return;
    }

    case "catPick": {
      if (interaction.kind === "saved" && interaction.transactionId) {
        await updateTransactionCategory(userId, interaction.transactionId, decoded.id);
      } else if (interaction.kind === "draft" && items.length === 1) {
        const name = await getCategoryName(userId, decoded.id);
        if (name) await updateInteractionPayload(chatIdStr, messageId, [{ ...items[0], category: name }]);
      }
      await editMessageText(chatId, messageId, message.text ?? "Kategori diubah.", {
        reply_markup: interaction.kind === "saved" ? savedConfirmKeyboard() : draftConfirmKeyboard(),
      });
      await answerCallbackQuery(cb.id, "Kategori diubah");
      return;
    }

    case "pktMenu": {
      const pockets = await listPocketsForUser(userId);
      if (pockets.length === 0) { await answerCallbackQuery(cb.id, "Belum ada kantong."); return; }
      await editMessageText(chatId, messageId, message.text ?? "Pilih kantong:", {
        reply_markup: pocketPickerKeyboard(pockets),
      });
      await answerCallbackQuery(cb.id);
      return;
    }

    case "pktPick": {
      if (interaction.kind === "saved" && interaction.transactionId) {
        await updateTransactionPocket(userId, interaction.transactionId, decoded.id);
      } else if (interaction.kind === "draft" && items.length === 1) {
        const name = await getPocketName(userId, decoded.id);
        if (name) await updateInteractionPayload(chatIdStr, messageId, [{ ...items[0], pocketName: name }]);
      }
      await editMessageText(chatId, messageId, message.text ?? "Kantong diubah.", {
        reply_markup: interaction.kind === "saved" ? savedConfirmKeyboard() : draftConfirmKeyboard(),
      });
      await answerCallbackQuery(cb.id, "Kantong diubah");
      return;
    }

    case "amt": {
      const promptId = await sendForceReply(chatId, "💵 Ketik nominal baru (mis. 50rb):");
      if (promptId !== null) await setInteractionPendingAmount(chatIdStr, messageId, promptId);
      await answerCallbackQuery(cb.id);
      return;
    }

    case "back": {
      await editMessageText(chatId, messageId, message.text ?? "", {
        reply_markup: interaction.kind === "saved" ? savedConfirmKeyboard() : draftConfirmKeyboard(),
      });
      await answerCallbackQuery(cb.id);
      return;
    }
  }
}
```

Note on category/pocket edits for **drafts**: for single-item drafts the pick is written back into the interaction `payload` (`updateInteractionPayload`), so the eventual Save uses the corrected category/pocket. `resolveCategory`/`resolvePocket` run at Save time to turn the stored names into ids. For **saved** transactions the change is persisted to the DB row immediately. Multi-item drafts expose only Save/Cancel, so their per-item category/pocket cannot be edited (spec non-goal).

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/telegram/callbacks.ts
git commit -m "feat: handle telegram callback_query button actions"
```

---

## Task 10: Amount-edit reply flow

**Files:**
- Modify: `lib/telegram/handler.ts`

When the user replies to the force_reply prompt, parse the amount and apply it.

- [ ] **Step 1: Add amount-reply handling in `handleUpdate`**

In `lib/telegram/handler.ts`, add imports:

```ts
import { findInteractionByPrompt, clearInteractionPending, updateTransactionAmount, updateInteractionPayload, type DraftItem } from "@/lib/services/telegram.service";
import { handleCallbackQuery } from "./callbacks";
```

Then in `handleUpdate`, before the `if (msg.text?.startsWith("/"))` block, add the reply interception:

```ts
    if (msg.text && msg.reply_to_message) {
      const handled = await handleAmountReply(chatId, chatIdStr, msg.text, msg.reply_to_message.message_id);
      if (handled) return;
    }
```

And route callback queries at the top of `handleUpdate` (after `const msg = update.message;` guard is adjusted). Replace the early `if (!msg) return;` with:

```ts
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg) return;
```

- [ ] **Step 2: Implement `handleAmountReply`**

Add to `lib/telegram/handler.ts`:

```ts
async function handleAmountReply(
  chatId: number,
  chatIdStr: string,
  text: string,
  replyToMessageId: number,
): Promise<boolean> {
  const interaction = await findInteractionByPrompt(chatIdStr, replyToMessageId);
  if (!interaction) return false;

  const parsed = parseMessage(`pengeluaran x ${text}`); // reuse amount parser
  const amount = parsed?.amount ?? null;
  if (amount === null) {
    await sendMessage(chatId, "Nominal tidak dikenali. Ketik angka seperti 50rb atau 50000.");
    return true;
  }

  await clearInteractionPending(chatIdStr, interaction.messageId);

  if (interaction.kind === "saved" && interaction.transactionId) {
    await updateTransactionAmount(interaction.userId, interaction.transactionId, amount);
    await sendMessage(chatId, `✅ Nominal diperbarui: ${formatRupiah(amount)}`);
  } else {
    const items = (interaction.payload as DraftItem[] | null) ?? [];
    if (items.length === 1) {
      await updateInteractionPayload(chatIdStr, interaction.messageId, [{ ...items[0], amount }]);
    }
    await sendMessage(chatId, `Nominal draft jadi ${formatRupiah(amount)}. Tekan ✅ Simpan di pesan sebelumnya untuk menyimpan.`);
  }
  return true;
}
```

Note: parsing via `parseMessage("pengeluaran x " + text)` reuses the existing Indonesian amount parser (handles `50rb`, `lima puluh ribu`, `50.000`). For single-item drafts the new amount is written back into the payload so the eventual Save uses it; saved transactions update the DB row immediately. The amount-edit button only appears on single-item drafts (`draftConfirmKeyboard`), so multi-item drafts never reach the draft branch here.

- [ ] **Step 3: Verify lint + tests**

Run: `npm run lint && npx vitest run`
Expected: lint clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/telegram/handler.ts
git commit -m "feat: apply amount edits from force_reply replies"
```

---

## Task 11: Webhook routing for callback queries

**Files:**
- Modify: `app/api/telegram/webhook/route.ts`

`handleUpdate` already handles `callback_query` (Task 10). The webhook only needs to keep passing the full update through; the existing `update_id` dedup covers callbacks too. Verify no change is needed beyond confirming `callback_query` updates carry an `update_id` (they do).

- [ ] **Step 1: Confirm the webhook forwards callback updates**

Read `app/api/telegram/webhook/route.ts`. The current body parses `update` and calls `handleUpdate(update)` after the dedup claim. Since `handleUpdate` now branches on `update.callback_query`, no code change is required. Add a clarifying comment above `handleUpdate(update)`:

```ts
  // handleUpdate routes message, callback_query (button taps), and replies.
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `Compiled successfully` and `Running TypeScript ...` passes (clean `.next` first if a stale type error about `old/register` appears: `rm -rf .next && npm run build`).

- [ ] **Step 3: Commit**

```bash
git add app/api/telegram/webhook/route.ts
git commit -m "docs: note callback routing in telegram webhook"
```

---

## Task 12: Full verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + new callbacks/keyboards/service tests).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && rm -rf .next && npm run build`
Expected: lint clean; build succeeds.

- [ ] **Step 3: Manual smoke test (requires a deployed/tunneled webhook)**

Verify each path against the real bot:
1. `pengeluaran makan 50rb` → saved immediately, keyboard `↩️ ✏️ 💼 💵`.
2. Tap `✏️ Kategori` → category list appears → pick one → confirmation returns, category changed (check `/riwayat`).
3. Tap `💵 Nominal` → reply `75rb` → "Nominal diperbarui".
4. Tap `↩️ Batal` → transaction removed (check `/riwayat`).
5. Send a slightly ambiguous text the parser misses (AI fallback) → preview with `✅ ❌` → tap `✅` → saved.
6. Send a receipt photo → preview → `✅` saves; multi-item receipt shows total.
7. Tap a button on an hour-old message → "Sesi sudah berakhir".

- [ ] **Step 4: Final commit (if any doc/notes updated)**

```bash
git add -A
git commit -m "chore: verify telegram confirmation loop end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** hybrid save flow (Tasks 7–8), category/pocket/amount/undo edits (Tasks 5,9,10), `TelegramInteraction` model + `(chatId,messageId)` keying (Task 1), `callback_data` ≤64B codec (Task 2), lazy expiry (Task 6 `getInteraction`), ownership checks (Task 5), webhook routing + `update_id` dedup reuse (Tasks 10–11), concise confirmations / no budget-feedback (Tasks 7–8 messages), tests (Tasks 2,3,5,6). All spec sections map to a task.
- **Refinements vs spec (all documented inline):** (1) added `promptMessageId` to the model to implement "matched via reply_to_message_id"; (2) added a `source` column so AI-text/voice/photo drafts save with the correct `TransactionSource` instead of a hardcoded value; (3) single-item draft edits (category/pocket/amount) persist into the interaction `payload` so Save uses the corrected values; (4) multi-item drafts use `draftSaveOnlyKeyboard` (Save/Cancel only) per the multi-receipt non-goal.
- **Type consistency:** `DraftItem` defined once in `telegram.service.ts` and imported everywhere; `createTransactionFromBot` returns `{ id, ... }` used for `transactionId`; keyboard builders' `callback_data` matches the codec strings exactly; `interaction.source` typed by the Prisma `TransactionSource` enum and passed to `createTransactionFromBot`'s `source`.
```
