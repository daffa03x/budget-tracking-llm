# Telegram Budget Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a Telegram bot into the existing Next.js budget tracker so users can record income/expenses via text, voice note, and receipt photos, synced to their web account via a one-time permanent linking flow.

**Architecture:** A webhook API route receives Telegram updates and dispatches to `lib/telegram/handler.ts`. The handler resolves categories/pockets via `lib/telegram/resolver.ts`, then persists transactions through a new bot-specific service function that extends the existing Prisma layer. Auth linking is token-based — linked once, permanent until explicitly unlinked.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (PostgreSQL), NextAuth v5 JWT, Groq Whisper API (STT), Google Gemini 2.0 Flash (LLM + Vision), Vitest (unit tests), date-fns (already in dependencies)

---

## File Map

**Created:**
- `vitest.config.ts` — test runner configuration
- `lib/telegram/types.ts` — shared `ParsedTransaction` type
- `lib/telegram/api.ts` — Telegram Bot API calls (sendMessage, downloadFile)
- `lib/telegram/parser.ts` — regex fast-path parser + `formatRupiah`
- `lib/telegram/stt.ts` — Groq Whisper speech-to-text
- `lib/telegram/llm.ts` — Gemini text extraction + vision receipt reading
- `lib/telegram/resolver.ts` — category/pocket lookup and auto-create
- `lib/telegram/report.ts` — report generators (daily/weekly/monthly)
- `lib/telegram/handler.ts` — main update router + command handler
- `lib/services/telegram.service.ts` — `createTransactionFromBot` and linked-user helpers
- `app/api/telegram/webhook/route.ts` — webhook receiver (nodejs runtime)
- `app/api/telegram/setup/route.ts` — one-time webhook registration
- `app/api/telegram/link/route.ts` — auth linking (POST/GET/DELETE)
- `components/telegram/telegram-link-card.tsx` — settings UI component
- `lib/telegram/__tests__/parser.test.ts` — parser unit tests
- `lib/telegram/__tests__/resolver.test.ts` — resolver unit tests

**Modified:**
- `prisma/schema.prisma` — add `TelegramLink` model, `TransactionSource` enum, new Transaction fields
- `package.json` — add vitest, vite-tsconfig-paths dev deps, test scripts
- `app/(dashboard)/settings/page.tsx` — render `TelegramLinkCard`
- `.env` — add Telegram/Groq/Gemini env vars

---

## Task 1: Setup Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install test dependencies**

```powershell
npm install -D vitest vite-tsconfig-paths
```

Expected output: `added 2 packages`

- [ ] **Step 2: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify setup**

```powershell
npm test -- --reporter=verbose
```

Expected: `No test files found` (no error, just 0 tests).

---

## Task 2: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `TransactionSource` enum after existing enums**

In `prisma/schema.prisma`, after the `AccountConnectionStatus` enum, add:

```prisma
enum TransactionSource {
  web
  text
  voice
  image
}
```

- [ ] **Step 2: Add three fields to the `Transaction` model**

In the `Transaction` model, after `updatedAt`, add:

```prisma
  source         TransactionSource @default(web)
  rawInput       String?
  telegramChatId String?
```

Also add a new index at the bottom of the `Transaction` model:

```prisma
  @@index([telegramChatId])
```

- [ ] **Step 3: Add `telegramLinks` relation to `User` model**

In the `User` model, after `pockets Pocket[]`, add:

```prisma
  telegramLinks TelegramLink[]
```

- [ ] **Step 4: Add `TelegramLink` model at the end of schema.prisma**

```prisma
model TelegramLink {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  chatId    String?
  username  String?
  firstName String?
  linked    Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([chatId])
}
```

- [ ] **Step 5: Run migration**

```powershell
npx prisma migrate dev --name add-telegram-bot
```

Expected: migration file created, schema applied.

- [ ] **Step 6: Regenerate Prisma client**

```powershell
npx prisma generate
```

Expected: `Generated Prisma Client` in `lib/generated/prisma`.

---

## Task 3: Environment Variables

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add required variables to `.env`**

Add to `.env` (fill in actual values):

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username_without_at
TELEGRAM_WEBHOOK_SECRET=any_random_string_min_32_chars

# Groq (Speech-to-Text — free at console.groq.com)
GROQ_API_KEY=your_groq_api_key

# Google Gemini (LLM + Vision — free at aistudio.google.com/apikey)
GEMINI_API_KEY=your_gemini_api_key
```

`NEXT_PUBLIC_APP_URL` is needed for the setup route. If not already in `.env`, add:

```env
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

---

## Task 4: Shared Types

**Files:**
- Create: `lib/telegram/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// lib/telegram/types.ts
export type ParsedTransaction = {
  type: "income" | "expense";
  amount: number;
  category: string;
  pocketName: string | null;
};

export type TelegramFrom = {
  id: number;
  username?: string;
  first_name?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramFrom;
  chat: { id: number };
  text?: string;
  voice?: { file_id: string; duration: number };
  photo?: Array<{ file_id: string; width: number; height: number }>;
  caption?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};
```

---

## Task 5: Telegram API Wrapper

**Files:**
- Create: `lib/telegram/api.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/telegram/api.ts
const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(
  chatId: number,
  text: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...options }),
  });
}

export async function sendChatAction(
  chatId: number,
  action: "typing" | "upload_photo",
): Promise<void> {
  await fetch(`${BASE}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export async function getFileUrl(fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/getFile?file_id=${fileId}`);
  const data = (await res.json()) as { result: { file_path: string } };
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

---

## Task 6: Message Parser (TDD)

**Files:**
- Create: `lib/telegram/__tests__/parser.test.ts`
- Create: `lib/telegram/parser.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/telegram/__tests__/parser.test.ts
import { describe, it, expect } from "vitest";
import { parseMessage, formatRupiah } from "../parser";

describe("parseMessage — expense keywords", () => {
  it("pengeluaran + category + rb amount", () => {
    expect(parseMessage("pengeluaran makan siang 50rb")).toEqual({
      type: "expense",
      amount: 50000,
      category: "Makan Siang",
      pocketName: null,
    });
  });

  it("beli keyword", () => {
    expect(parseMessage("beli kopi 25k")).toEqual({
      type: "expense",
      amount: 25000,
      category: "Kopi",
      pocketName: null,
    });
  });

  it("bayar with dot-separated amount", () => {
    expect(parseMessage("bayar listrik 500.000")).toEqual({
      type: "expense",
      amount: 500000,
      category: "Listrik",
      pocketName: null,
    });
  });

  it("plain number no suffix", () => {
    expect(parseMessage("pengeluaran bensin 80000")).toEqual({
      type: "expense",
      amount: 80000,
      category: "Bensin",
      pocketName: null,
    });
  });
});

describe("parseMessage — income keywords", () => {
  it("masuk gaji jt amount", () => {
    expect(parseMessage("masuk gaji 5jt")).toEqual({
      type: "income",
      amount: 5000000,
      category: "Gaji",
      pocketName: null,
    });
  });

  it("pemasukan with decimal jt", () => {
    expect(parseMessage("pemasukan freelance 2.5jt")).toEqual({
      type: "income",
      amount: 2500000,
      category: "Freelance",
      pocketName: null,
    });
  });
});

describe("parseMessage — pocket detection", () => {
  it("extracts pocket after 'dari'", () => {
    expect(parseMessage("pengeluaran makan 50rb dari BCA")).toEqual({
      type: "expense",
      amount: 50000,
      category: "Makan",
      pocketName: "BCA",
    });
  });

  it("extracts pocket after 'ke'", () => {
    expect(parseMessage("pengeluaran transfer 200rb ke Mandiri")).toEqual({
      type: "expense",
      amount: 200000,
      category: "Transfer",
      pocketName: "Mandiri",
    });
  });
});

describe("parseMessage — null cases", () => {
  it("returns null for plain question", () => {
    expect(parseMessage("halo apa kabar")).toBeNull();
  });

  it("returns null for message without amount", () => {
    expect(parseMessage("pengeluaran makan")).toBeNull();
  });

  it("returns null for keyword with no category", () => {
    expect(parseMessage("beli 50rb")).toBeNull();
  });
});

describe("formatRupiah", () => {
  it("formats 50000 as Rp50.000", () => {
    expect(formatRupiah(50000)).toBe("Rp50.000");
  });

  it("formats 5000000 as Rp5.000.000", () => {
    expect(formatRupiah(5000000)).toBe("Rp5.000.000");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
npm test -- lib/telegram/__tests__/parser.test.ts
```

Expected: `FAIL — Cannot find module '../parser'`

- [ ] **Step 3: Implement parser.ts**

```typescript
// lib/telegram/parser.ts
import type { ParsedTransaction } from "./types";

const EXPENSE_RE = /^(pengeluaran|keluar|beli|bayar|byr)\s+/i;
const INCOME_RE = /^(pemasukan|masuk|terima|gaji|dapat|dpt)\s+/i;
const POCKET_RE = /\s+(?:dari|ke)\s+(.+)$/i;
// Matches number at end: "50rb", "5jt", "500.000", "80000", "2.5jt", "25k"
const AMOUNT_RE = /^(.*?)\s+([\d][\d.,]*(?:[.,]\d+)?)\s*(rb|ribu|jt|juta|k)?\s*$/i;

function normalizeNumber(s: string, hasSuffix: boolean): number | null {
  const dotCount = (s.match(/\./g) ?? []).length;
  const commaCount = (s.match(/,/g) ?? []).length;

  if (dotCount === 0 && commaCount === 0) return parseFloat(s);

  if (hasSuffix) {
    if (dotCount === 1 && commaCount === 0) {
      // "2.5" → decimal; "1.500" → thousand separator
      const dec = s.split(".")[1];
      return dec.length <= 2 ? parseFloat(s) : parseFloat(s.replace(".", ""));
    }
    if (commaCount === 1 && dotCount === 0) {
      return parseFloat(s.replace(",", "."));
    }
  }

  // Indonesian: dots = thousand separators, comma = decimal
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function parseAmount(numStr: string, suffix: string): number | null {
  const n = normalizeNumber(numStr, suffix !== "");
  if (n === null || isNaN(n) || n <= 0) return null;
  const mult: Record<string, number> = {
    rb: 1_000,
    ribu: 1_000,
    jt: 1_000_000,
    juta: 1_000_000,
    k: 1_000,
  };
  return Math.round(n * (mult[suffix.toLowerCase()] ?? 1));
}

export function parseMessage(text: string): ParsedTransaction | null {
  const trimmed = text.trim();
  let type: "income" | "expense";
  let body: string;

  if (EXPENSE_RE.test(trimmed)) {
    type = "expense";
    body = trimmed.replace(EXPENSE_RE, "").trim();
  } else if (INCOME_RE.test(trimmed)) {
    type = "income";
    body = trimmed.replace(INCOME_RE, "").trim();
  } else {
    return null;
  }

  let pocketName: string | null = null;
  const pocketMatch = body.match(POCKET_RE);
  if (pocketMatch) {
    pocketName = pocketMatch[1].trim();
    body = body.slice(0, body.length - pocketMatch[0].length).trim();
  }

  const amountMatch = body.match(AMOUNT_RE);
  if (!amountMatch) return null;

  const [, categoryRaw, numStr, suffix = ""] = amountMatch;
  const amount = parseAmount(numStr, suffix);
  if (amount === null) return null;

  const catTrimmed = categoryRaw.trim();
  if (!catTrimmed) return null;

  const category = catTrimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return { type, amount, category, pocketName };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```powershell
npm test -- lib/telegram/__tests__/parser.test.ts
```

Expected: `✓ 13 tests passed`

---

## Task 7: STT Service (Groq Whisper)

**Files:**
- Create: `lib/telegram/stt.ts`

- [ ] **Step 1: Create stt.ts**

```typescript
// lib/telegram/stt.ts
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: "audio/ogg" }),
    "audio.ogg",
  );
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "id");
  formData.append("response_format", "text");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Groq STT error: ${res.status} ${await res.text()}`);
  }

  return res.text();
}
```

---

## Task 8: LLM Service (Gemini)

**Files:**
- Create: `lib/telegram/llm.ts`

- [ ] **Step 1: Create llm.ts**

```typescript
// lib/telegram/llm.ts
import type { ParsedTransaction } from "./types";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

async function callGemini(parts: unknown[]): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates[0].content.parts[0].text;
}

export async function extractTransactionFromText(
  text: string,
): Promise<ParsedTransaction | null> {
  const prompt = `Kamu adalah parser transaksi keuangan. Extract informasi transaksi dari pesan bahasa Indonesia berikut.

Rules:
- Tentukan apakah ini income atau expense
- Extract nominal dalam angka (bukan string)
- Extract kategori singkat (1-2 kata, capitalize)
- Jika bukan transaksi keuangan, return null
- Konversi angka dalam kata: "lima puluh ribu" = 50000, "tiga juta" = 3000000
- Slang: "goceng" = 5000, "ceban" = 10000, "cepek" = 100000

Respond ONLY with JSON (no markdown):
{"type": "income" | "expense", "amount": number, "category": "string"}

Atau jika bukan transaksi:
null

Pesan: "${text.replace(/"/g, '\\"')}"`;

  const raw = await callGemini([{ text: prompt }]);

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!["income", "expense"].includes(parsed.type)) return null;
    if (typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
    if (typeof parsed.category !== "string") return null;
    return {
      type: parsed.type as "income" | "expense",
      amount: parsed.amount,
      category: parsed.category,
      pocketName: null,
    };
  } catch {
    return null;
  }
}

export async function extractTransactionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  caption?: string,
): Promise<ParsedTransaction[]> {
  const base64 = imageBuffer.toString("base64");
  const captionHint = caption ? `Caption dari user: "${caption}"` : "";

  const prompt = `Kamu adalah pembaca struk/receipt belanja. Analisis foto struk ini dan extract informasi transaksi.

Rules:
- Identifikasi TOTAL PEMBAYARAN (bukan subtotal per-item)
- Semua transaksi dari struk adalah expense
- Kategori dari nama toko atau jenis belanjaan (contoh: "Groceries", "Makan", "Transportasi")
- ${captionHint}
- Jika bukan foto struk/receipt, return array kosong
- Nominal dalam Rupiah (IDR)

Respond ONLY with JSON array (no markdown):
[{"type": "expense", "amount": number, "category": "string"}]

Atau jika bukan struk:
[]`;

  const raw = await callGemini([
    { inlineData: { mimeType, data: base64 } },
    { text: prompt },
  ]);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { type: "expense"; amount: number; category: string } =>
          item?.type === "expense" &&
          typeof item.amount === "number" &&
          item.amount > 0 &&
          typeof item.category === "string",
      )
      .map((item) => ({
        type: "expense" as const,
        amount: item.amount,
        category: item.category,
        pocketName: null,
      }));
  } catch {
    return [];
  }
}
```

---

## Task 9: Category & Pocket Resolver (TDD)

**Files:**
- Create: `lib/telegram/__tests__/resolver.test.ts`
- Create: `lib/telegram/resolver.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/telegram/__tests__/resolver.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    pocket: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveCategory, resolvePocket } from "../resolver";

describe("resolveCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing user category id", async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValueOnce({ id: "cat-1" } as never);
    const id = await resolveCategory("user-1", "Makan", "expense");
    expect(id).toBe("cat-1");
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", name: { equals: "Makan", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("falls back to default category when user category not found", async () => {
    vi.mocked(prisma.category.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "default-1" } as never);
    const id = await resolveCategory("user-1", "Makanan", "expense");
    expect(id).toBe("default-1");
  });

  it("creates new category when no match exists", async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.category.create).mockResolvedValue({ id: "new-1" } as never);
    const id = await resolveCategory("user-1", "Hobi", "expense");
    expect(id).toBe("new-1");
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: "Hobi", type: "expense", userId: "user-1" },
      select: { id: true },
    });
  });
});

describe("resolvePocket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pocket id when found", async () => {
    vi.mocked(prisma.pocket.findFirst).mockResolvedValue({ id: "pocket-1" } as never);
    const id = await resolvePocket("user-1", "BCA");
    expect(id).toBe("pocket-1");
  });

  it("returns null when pocket not found", async () => {
    vi.mocked(prisma.pocket.findFirst).mockResolvedValue(null);
    const id = await resolvePocket("user-1", "Nonexistent");
    expect(id).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
npm test -- lib/telegram/__tests__/resolver.test.ts
```

Expected: `FAIL — Cannot find module '../resolver'`

- [ ] **Step 3: Implement resolver.ts**

```typescript
// lib/telegram/resolver.ts
import { prisma } from "@/lib/prisma";

export async function resolveCategory(
  userId: string,
  name: string,
  type: "income" | "expense",
): Promise<string> {
  // 1. User's own categories (case-insensitive match)
  const userCat = await prisma.category.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (userCat) return userCat.id;

  // 2. Default system categories
  const defaultCat = await prisma.category.findFirst({
    where: {
      isDefault: true,
      userId: null,
      name: { equals: name, mode: "insensitive" },
      type: { in: [type, "both"] },
    },
    select: { id: true },
  });
  if (defaultCat) return defaultCat.id;

  // 3. Create new category for this user
  const newCat = await prisma.category.create({
    data: { name, type, userId },
    select: { id: true },
  });
  return newCat.id;
}

export async function resolvePocket(
  userId: string,
  name: string,
): Promise<string | null> {
  const pocket = await prisma.pocket.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return pocket?.id ?? null;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```powershell
npm test -- lib/telegram/__tests__/resolver.test.ts
```

Expected: `✓ 5 tests passed`

---

## Task 10: Bot Transaction Service

**Files:**
- Create: `lib/services/telegram.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// lib/services/telegram.service.ts
import { prisma } from "@/lib/prisma";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";

type BotTransactionInput = {
  type: "income" | "expense";
  amount: number;
  categoryId: string;
  pocketId?: string | null;
  description?: string | null;
  source: "text" | "voice" | "image";
  rawInput?: string | null;
  telegramChatId: string;
  userId: string;
  date?: Date;
};

export async function createTransactionFromBot(input: BotTransactionInput) {
  const date = input.date ?? new Date();

  const transaction = await prisma.transaction.create({
    data: {
      amount: input.amount.toFixed(2),
      type: input.type,
      description: input.description ?? null,
      date,
      categoryId: input.categoryId,
      pocketId: input.pocketId ?? null,
      source: input.source,
      rawInput: input.rawInput ?? null,
      telegramChatId: input.telegramChatId,
      userId: input.userId,
    },
    select: {
      id: true,
      amount: true,
      type: true,
      category: { select: { name: true } },
    },
  });

  await syncBudgetsForExpenseChange(input.userId, [
    { type: input.type, categoryId: input.categoryId, date },
  ]);

  return transaction;
}

export async function getLinkedUserId(chatId: string): Promise<string | null> {
  const link = await prisma.telegramLink.findFirst({
    where: { chatId, linked: true },
    select: { userId: true },
  });
  return link?.userId ?? null;
}
```

---

## Task 11: Report Generator

**Files:**
- Create: `lib/telegram/report.ts`

- [ ] **Step 1: Create report.ts**

```typescript
// lib/telegram/report.ts
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "./parser";

async function buildReport(
  chatId: string,
  from: Date,
  to: Date,
  label: string,
): Promise<string> {
  const rows = await prisma.transaction.findMany({
    where: { telegramChatId: chatId, date: { gte: from, lte: to } },
    select: {
      type: true,
      amount: true,
      category: { select: { name: true } },
    },
  });

  if (rows.length === 0) {
    return `📊 <b>Laporan ${label}</b>\n\nBelum ada transaksi.`;
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Record<string, number> = {};

  for (const r of rows) {
    const a = Number(r.amount);
    if (r.type === "income") {
      totalIncome += a;
    } else {
      totalExpense += a;
      const cat = r.category?.name ?? "Lainnya";
      byCategory[cat] = (byCategory[cat] ?? 0) + a;
    }
  }

  const lines = [
    `📊 <b>Laporan ${label}</b>`,
    "",
    `💰 Pemasukan : <b>${formatRupiah(totalIncome)}</b>`,
    `💸 Pengeluaran: <b>${formatRupiah(totalExpense)}</b>`,
    `📈 Saldo      : <b>${formatRupiah(totalIncome - totalExpense)}</b>`,
  ];

  const cats = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  if (cats.length > 0) {
    lines.push("", "<b>Breakdown pengeluaran:</b>");
    for (const [cat, amt] of cats) {
      lines.push(`  • ${cat}: ${formatRupiah(amt)}`);
    }
  }

  lines.push("", `Total transaksi: ${rows.length}`);
  return lines.join("\n");
}

export async function generateDailyReport(chatId: string): Promise<string> {
  const now = new Date();
  return buildReport(chatId, startOfDay(now), endOfDay(now), "Hari Ini");
}

export async function generateWeeklyReport(chatId: string): Promise<string> {
  const now = new Date();
  return buildReport(
    chatId,
    startOfWeek(now, { weekStartsOn: 1 }),
    endOfWeek(now, { weekStartsOn: 1 }),
    "Minggu Ini",
  );
}

export async function generateMonthlyReport(
  chatId: string,
  month?: number,
  year?: number,
): Promise<string> {
  const now = new Date();
  const d = new Date(year ?? now.getFullYear(), month !== undefined ? month - 1 : now.getMonth(), 1);
  const label = d.toLocaleString("id-ID", { month: "long", year: "numeric" });
  return buildReport(chatId, startOfMonth(d), endOfMonth(d), label);
}

export async function getRecentTransactions(
  chatId: string,
  limit = 5,
): Promise<string> {
  const sourceIcon: Record<string, string> = {
    text: "📝",
    voice: "🎙️",
    image: "📷",
    web: "🌐",
  };

  const rows = await prisma.transaction.findMany({
    where: { telegramChatId: chatId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      type: true,
      amount: true,
      source: true,
      date: true,
      category: { select: { name: true } },
    },
  });

  if (rows.length === 0) return "📋 Belum ada riwayat transaksi.";

  const lines = [`📋 <b>${limit} Transaksi Terakhir</b>`, ""];
  for (const r of rows) {
    const icon = sourceIcon[r.source] ?? "📝";
    const typeIcon = r.type === "income" ? "💰" : "💸";
    const date = new Date(r.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    lines.push(
      `${icon}${typeIcon} ${r.category?.name ?? "Lainnya"} — ${formatRupiah(Number(r.amount))} (${date})`,
    );
  }
  return lines.join("\n");
}

export async function deleteLastTransaction(chatId: string): Promise<string> {
  const last = await prisma.transaction.findFirst({
    where: { telegramChatId: chatId },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, type: true, category: { select: { name: true } } },
  });

  if (!last) return "Tidak ada transaksi yang bisa dihapus.";

  await prisma.transaction.delete({ where: { id: last.id } });

  const typeStr = last.type === "income" ? "Pemasukan" : "Pengeluaran";
  return `✅ Dihapus: ${typeStr} ${last.category?.name ?? "Lainnya"} ${formatRupiah(Number(last.amount))}`;
}
```

---

## Task 12: Bot Handler

**Files:**
- Create: `lib/telegram/handler.ts`

- [ ] **Step 1: Create handler.ts**

```typescript
// lib/telegram/handler.ts
import { sendMessage, sendChatAction, downloadFile } from "./api";
import { parseMessage, formatRupiah } from "./parser";
import { transcribeAudio } from "./stt";
import { extractTransactionFromText, extractTransactionFromImage } from "./llm";
import { resolveCategory, resolvePocket } from "./resolver";
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getRecentTransactions,
  deleteLastTransaction,
} from "./report";
import { createTransactionFromBot, getLinkedUserId } from "@/lib/services/telegram.service";
import { prisma } from "@/lib/prisma";
import type { ParsedTransaction, TelegramUpdate } from "./types";

const NOT_LINKED =
  `❌ Akun belum terhubung.\n\n` +
  `<b>Cara menghubungkan:</b>\n` +
  `1. Buka website budget tracker\n` +
  `2. Pergi ke Settings → Telegram Bot\n` +
  `3. Klik "Hubungkan Telegram" → klik link yang muncul`;

const HELP =
  `🤖 <b>Budget Bot</b>\n\n` +
  `<b>Catat transaksi:</b>\n` +
  `📝 Teks: <code>pengeluaran makan 50rb</code>\n` +
  `🎙️ Voice note: ucapkan transaksimu\n` +
  `📷 Foto struk: kirim foto receipt\n\n` +
  `<b>Format teks:</b>\n` +
  `• <code>pengeluaran [kategori] [nominal]</code>\n` +
  `• <code>pemasukan [kategori] [nominal]</code>\n` +
  `• Nominal: 50rb · 5jt · 25k · 500.000\n\n` +
  `<b>Laporan:</b>\n` +
  `/hari · /minggu · /bulan\n` +
  `/bulan 3 · /bulan 3 2025\n\n` +
  `<b>Lainnya:</b>\n` +
  `/riwayat [n] · /hapus · /status`;

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);

  try {
    if (msg.text?.startsWith("/")) {
      await handleCommand(chatId, chatIdStr, msg.text, msg.from);
      return;
    }

    if (msg.text) {
      await handleText(chatId, chatIdStr, msg.text);
      return;
    }

    if (msg.voice) {
      await handleVoice(chatId, chatIdStr, msg.voice.file_id);
      return;
    }

    if (msg.photo && msg.photo.length > 0) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await handlePhoto(chatId, chatIdStr, fileId, msg.caption);
      return;
    }

    await sendMessage(
      chatId,
      "Saya hanya bisa memproses teks, voice note, dan foto struk. Ketik /help untuk panduan.",
    );
  } catch (err) {
    console.error("[Bot] unhandled error:", err);
  }
}

async function handleText(chatId: number, chatIdStr: string, text: string): Promise<void> {
  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  const parsed = parseMessage(text);
  if (parsed) {
    await saveAndConfirm(chatId, chatIdStr, userId, parsed, "text", text);
    return;
  }

  try {
    const llmResult = await extractTransactionFromText(text);
    if (llmResult) {
      await saveAndConfirm(chatId, chatIdStr, userId, llmResult, "text", text);
      return;
    }
  } catch {
    await sendMessage(chatId, "🤖 Layanan AI sedang sibuk. Coba format: pengeluaran [kategori] [nominal]");
    return;
  }

  await sendMessage(chatId, "Tidak bisa memproses pesan ini sebagai transaksi.\n\nContoh: <code>pengeluaran makan siang 50rb</code>");
}

async function handleVoice(chatId: number, chatIdStr: string, fileId: string): Promise<void> {
  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  await sendChatAction(chatId, "typing");

  let buffer: Buffer;
  try {
    buffer = await downloadFile(fileId);
  } catch {
    await sendMessage(chatId, "Gagal mengunduh file. Coba kirim ulang.");
    return;
  }

  let transcript: string;
  try {
    transcript = await transcribeAudio(buffer);
  } catch {
    await sendMessage(chatId, "🎙️ Layanan transkripsi sedang sibuk. Coba lagi dalam 1 menit, atau ketik manual.");
    return;
  }

  await sendMessage(chatId, `🎙️ <i>"${transcript}"</i>`);

  const parsed = parseMessage(transcript);
  if (parsed) {
    await saveAndConfirm(chatId, chatIdStr, userId, parsed, "voice", transcript);
    return;
  }

  try {
    const llmResult = await extractTransactionFromText(transcript);
    if (llmResult) {
      await saveAndConfirm(chatId, chatIdStr, userId, llmResult, "voice", transcript);
      return;
    }
  } catch {
    // fall through
  }

  await sendMessage(chatId, "Maaf, tidak bisa memahami voice note ini sebagai transaksi.\nCoba format: pengeluaran [kategori] [nominal]");
}

async function handlePhoto(
  chatId: number,
  chatIdStr: string,
  fileId: string,
  caption?: string,
): Promise<void> {
  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  await sendChatAction(chatId, "typing");

  let buffer: Buffer;
  try {
    buffer = await downloadFile(fileId);
  } catch {
    await sendMessage(chatId, "Gagal mengunduh foto. Coba kirim ulang.");
    return;
  }

  let results: ParsedTransaction[];
  try {
    results = await extractTransactionFromImage(buffer, "image/jpeg", caption);
  } catch {
    await sendMessage(chatId, "🤖 Layanan AI sedang sibuk. Coba lagi sebentar.");
    return;
  }

  if (results.length === 0) {
    await sendMessage(chatId, "Maaf, tidak bisa membaca foto ini sebagai struk belanja.\nPastikan foto struk-nya jelas dan tidak terpotong.");
    return;
  }

  const lines = ["📷 <b>Struk terbaca!</b>", ""];
  let total = 0;

  for (const r of results) {
    const categoryId = await resolveCategory(userId, r.category, r.type);
    await createTransactionFromBot({
      type: r.type,
      amount: r.amount,
      categoryId,
      pocketId: null,
      source: "image",
      rawInput: caption ?? null,
      telegramChatId: chatIdStr,
      userId,
    });
    lines.push(`💸 ${r.category} — ${formatRupiah(r.amount)}`);
    total += r.amount;
  }

  lines.push("", `Total: ${formatRupiah(total)} (${results.length} transaksi dicatat)`);
  await sendMessage(chatId, lines.join("\n"));
}

async function saveAndConfirm(
  chatId: number,
  chatIdStr: string,
  userId: string,
  parsed: ParsedTransaction,
  source: "text" | "voice",
  rawInput: string,
): Promise<void> {
  const categoryId = await resolveCategory(userId, parsed.category, parsed.type);
  let pocketId: string | null = null;
  if (parsed.pocketName) {
    pocketId = await resolvePocket(userId, parsed.pocketName);
  }

  await createTransactionFromBot({
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
  const date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  await sendMessage(
    chatId,
    `✅ Tercatat!\n\n${typeIcon} ${typeLabel}: ${parsed.category}\n💵 ${formatRupiah(parsed.amount)}${pocketLine}\n📅 ${date}`,
  );
}

async function handleCommand(
  chatId: number,
  chatIdStr: string,
  text: string,
  from: TelegramFrom | undefined,
): Promise<void> {
  const [rawCmd, ...args] = text.split(" ");
  const cmd = rawCmd.split("@")[0].toLowerCase();

  if (cmd === "/start") {
    if (args.length > 0) {
      await handleStartToken(chatId, chatIdStr, args[0], from);
    } else {
      const userId = await getLinkedUserId(chatIdStr);
      await sendMessage(
        chatId,
        userId ? `✅ Akun sudah terhubung! Ketik /help untuk panduan.` : NOT_LINKED,
      );
    }
    return;
  }

  if (cmd === "/help") {
    await sendMessage(chatId, HELP);
    return;
  }

  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  switch (cmd) {
    case "/hari":
      await sendMessage(chatId, await generateDailyReport(chatIdStr));
      break;
    case "/minggu":
      await sendMessage(chatId, await generateWeeklyReport(chatIdStr));
      break;
    case "/bulan": {
      const month = args[0] ? parseInt(args[0]) : undefined;
      const year = args[1] ? parseInt(args[1]) : undefined;
      await sendMessage(chatId, await generateMonthlyReport(chatIdStr, month, year));
      break;
    }
    case "/riwayat": {
      const limit = args[0] ? parseInt(args[0]) : 5;
      await sendMessage(chatId, await getRecentTransactions(chatIdStr, limit));
      break;
    }
    case "/hapus":
      await sendMessage(chatId, await deleteLastTransaction(chatIdStr));
      break;
    case "/status": {
      const link = await prisma.telegramLink.findFirst({
        where: { chatId: chatIdStr, linked: true },
        select: { username: true, firstName: true, createdAt: true },
      });
      if (!link) {
        await sendMessage(chatId, "❌ Akun belum terhubung.");
      } else {
        const since = link.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        await sendMessage(chatId, `✅ <b>Status: Terhubung</b>\n👤 ${link.firstName ?? ""} (@${link.username ?? "-"})\n📅 Sejak: ${since}`);
      }
      break;
    }
    default:
      await sendMessage(chatId, "Perintah tidak dikenal. Ketik /help untuk panduan.");
  }
}

async function handleStartToken(
  chatId: number,
  chatIdStr: string,
  token: string,
  from: TelegramFrom | undefined,
): Promise<void> {
  const link = await prisma.telegramLink.findUnique({
    where: { token },
    select: { id: true, userId: true, linked: true, expiresAt: true },
  });

  if (!link) {
    await sendMessage(chatId, "❌ Token tidak valid."); return;
  }
  if (link.linked) {
    await sendMessage(chatId, "❌ Token sudah digunakan."); return;
  }
  if (link.expiresAt < new Date()) {
    await prisma.telegramLink.delete({ where: { token } });
    await sendMessage(chatId, "❌ Token sudah expired. Generate link baru di website."); return;
  }

  const existingLink = await prisma.telegramLink.findFirst({
    where: { chatId: chatIdStr, linked: true },
  });
  if (existingLink && existingLink.userId !== link.userId) {
    await sendMessage(chatId, "⚠️ Chat ini sudah terhubung ke akun lain. Putuskan koneksi dulu di website."); return;
  }

  await prisma.telegramLink.update({
    where: { token },
    data: {
      chatId: chatIdStr,
      username: from?.username ?? null,
      firstName: from?.first_name ?? null,
      linked: true,
    },
  });

  await sendMessage(
    chatId,
    `✅ <b>Akun berhasil terhubung!</b>\n\nSekarang kamu bisa:\n• Kirim teks: <code>pengeluaran makan 50rb</code>\n• Kirim voice note\n• Kirim foto struk\n\nKetik /help untuk panduan lengkap.`,
  );
}
```

---

## Task 13: Webhook Route

**Files:**
- Create: `app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Create route.ts**

```typescript
// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handleUpdate } from "@/lib/telegram/handler";
import type { TelegramUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");

  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;

  // Process without awaiting — Telegram needs a fast <1s response
  handleUpdate(update).catch((err) =>
    console.error("[Telegram webhook] unhandled error:", err),
  );

  return NextResponse.json({ ok: true });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "Bot webhook is active ✅" });
}
```

---

## Task 14: Setup Route

**Files:**
- Create: `app/api/telegram/setup/route.ts`

- [ ] **Step 1: Create route.ts**

```typescript
// app/api/telegram/setup/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !appUrl || !secret) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      secret_token: secret,
    }),
  });

  const data = await res.json();
  return NextResponse.json({ webhook_url: webhookUrl, telegram_response: data });
}
```

---

## Task 15: Link Route

**Files:**
- Create: `app/api/telegram/link/route.ts`

- [ ] **Step 1: Create route.ts**

```typescript
// app/api/telegram/link/route.ts
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.telegramLink.findFirst({
    where: { userId, linked: true },
    select: { username: true, firstName: true, createdAt: true },
  });

  if (existing) {
    return NextResponse.json({
      already_linked: true,
      telegram_username: existing.username,
      telegram_name: existing.firstName,
      linked_at: existing.createdAt,
    });
  }

  // Remove stale unused tokens for this user
  await prisma.telegramLink.deleteMany({ where: { userId, linked: false } });

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.telegramLink.create({ data: { token, userId, expiresAt } });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=${token}`;

  return NextResponse.json({ deep_link: deepLink, expires_in: "15 menit" });
}

export async function GET(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.telegramLink.findFirst({
    where: { userId, linked: true },
    select: { linked: true, username: true, firstName: true, createdAt: true },
  });

  return NextResponse.json({
    linked: !!link,
    telegram_username: link?.username ?? null,
    telegram_name: link?.firstName ?? null,
    linked_at: link?.createdAt ?? null,
  });
}

export async function DELETE(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.telegramLink.deleteMany({ where: { userId } });

  return NextResponse.json({ success: true });
}
```

---

## Task 16: TelegramLinkCard Component

**Files:**
- Create: `components/telegram/telegram-link-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/telegram/telegram-link-card.tsx
"use client";

import { useState, useEffect } from "react";

type LinkStatus = {
  linked: boolean;
  telegram_username: string | null;
  telegram_name: string | null;
  linked_at: string | null;
};

type DeepLinkData = {
  deep_link: string;
  expires_in: string;
  already_linked?: boolean;
};

export function TelegramLinkCard({ initialStatus }: { initialStatus: LinkStatus }) {
  const [status, setStatus] = useState<LinkStatus>(initialStatus);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data: DeepLinkData = await res.json();
      if (data.already_linked) {
        await refreshStatus();
      } else {
        setDeepLink(data.deep_link);
        setExpiresIn(data.expires_in);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    const res = await fetch("/api/telegram/link");
    const data: LinkStatus = await res.json();
    setStatus(data);
    if (data.linked) setDeepLink(null);
  }

  async function handleUnlink() {
    if (!confirm("Putuskan koneksi Telegram? Kamu perlu link ulang untuk menggunakan bot.")) return;
    setLoading(true);
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      setStatus({ linked: false, telegram_username: null, telegram_name: null, linked_at: null });
      setDeepLink(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!deepLink) return;
    await navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (status.linked) {
    const since = status.linked_at
      ? new Date(status.linked_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Telegram Bot</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            ✓ Terhubung
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {status.telegram_name ?? ""}{status.telegram_username ? ` (@${status.telegram_username})` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Terhubung sejak {since}</p>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="text-sm text-destructive hover:underline disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Putuskan Koneksi"}
        </button>
      </div>
    );
  }

  if (deepLink) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Telegram Bot</h3>
        <p className="text-sm text-muted-foreground">
          Klik tombol di bawah untuk membuka Telegram dan menghubungkan akun.
        </p>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90"
        >
          Buka di Telegram →
        </a>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={deepLink}
            className="flex-1 text-xs border rounded px-2 py-1 bg-muted truncate"
          />
          <button
            onClick={handleCopy}
            className="text-xs border rounded px-2 py-1 whitespace-nowrap hover:bg-muted"
          >
            {copied ? "Disalin!" : "Salin"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Link berlaku {expiresIn}.</p>
        <button
          onClick={refreshStatus}
          className="text-sm text-primary hover:underline"
        >
          Cek Status Koneksi
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold">Telegram Bot</h3>
      <p className="text-sm text-muted-foreground">
        Catat keuangan via teks, voice note, dan foto struk langsung dari Telegram.
      </p>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Hubungkan Telegram"}
      </button>
    </div>
  );
}
```

---

## Task 17: Settings Page Integration

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Read current settings page**

Read `app/(dashboard)/settings/page.tsx` to see current imports and structure.

- [ ] **Step 2: Add import and fetch initial link status**

Add `TelegramLinkCard` import and fetch the initial link status server-side. The updated file:

```tsx
// app/(dashboard)/settings/page.tsx
import { SettingsManager } from "@/components/settings/settings-manager";
import { TelegramLinkCard } from "@/components/telegram/telegram-link-card";
import { getSharingOverview } from "@/lib/services/sharing.service";
import { getUserProfile } from "@/lib/services/user.service";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const profile = await getUserProfile(userId);

  if (!profile) {
    throw new Error("User profile not found.");
  }

  const [sharing, telegramLink] = await Promise.all([
    getSharingOverview(userId),
    prisma.telegramLink.findFirst({
      where: { userId, linked: true },
      select: { linked: true, username: true, firstName: true, createdAt: true },
    }),
  ]);

  const initialTelegramStatus = {
    linked: !!telegramLink,
    telegram_username: telegramLink?.username ?? null,
    telegram_name: telegramLink?.firstName ?? null,
    linked_at: telegramLink?.createdAt?.toISOString() ?? null,
  };

  return (
    <div className="space-y-6">
      <SettingsManager initialProfile={profile} initialSharing={sharing} />
      <TelegramLinkCard initialStatus={initialTelegramStatus} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```powershell
npm run build
```

Expected: no TypeScript or build errors.

---

## Task 18: Register Webhook (Deploy Step)

This step runs once after deployment.

- [ ] **Step 1: Set all env vars on your deployment platform**

Ensure these are set in production:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` (must be HTTPS)
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `DATABASE_URL`

- [ ] **Step 2: Hit the setup endpoint once**

Open in browser (or curl):

```
GET https://your-domain.com/api/telegram/setup
```

Expected response:
```json
{
  "webhook_url": "https://your-domain.com/api/telegram/webhook",
  "telegram_response": { "ok": true, "result": true }
}
```

- [ ] **Step 3: Test the bot**

In Telegram, open your bot and send `/start`. Expected: welcome message with linking instructions.

- [ ] **Step 4: Run all tests one final time**

```powershell
npm test
```

Expected: all tests pass.

---

## Quick Verification Checklist

After all tasks:

| Check | Command/Action |
|---|---|
| Schema migration | `npx prisma migrate status` → `Database schema is up to date` |
| Parser tests | `npm test -- parser.test` → 13 tests pass |
| Resolver tests | `npm test -- resolver.test` → 5 tests pass |
| Build clean | `npm run build` → no errors |
| Webhook health | `GET /api/telegram/webhook` → `{ status: "Bot webhook is active ✅" }` |
| Link flow | Settings page → "Hubungkan" → deep link → `/start TOKEN` in Telegram → success |
| Text transaction | Send `pengeluaran kopi 25k` → bot confirms → visible in dashboard |
| Voice note | Send voice note → transcription shown → transaction saved |
| Receipt photo | Send receipt photo → amounts extracted → transactions saved |
| `/hari` command | Shows today's report |
| `/hapus` command | Deletes last transaction |
| Unlink | Settings → "Putuskan Koneksi" → bot asks to link again |
