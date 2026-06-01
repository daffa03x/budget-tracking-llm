# Telegram /saldo Pocket Balance Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah command `/saldo` dan `/saldo [nama]` ke Telegram Bot agar user bisa cek saldo pocket langsung dari Telegram.

**Architecture:** Tambah fungsi `getPocketBalances(userId, filter?)` di `lib/telegram/report.ts` yang fetch pocket dari Prisma, hitung saldo (initialBalance + income - expense), dan filter by substring case-insensitive. Handler di `handler.ts` meneruskan args ke fungsi tersebut.

**Tech Stack:** TypeScript, Prisma (existing), Vitest (existing), Next.js App Router

---

## File Map

| Action | File | Perubahan |
|---|---|---|
| Create | `lib/telegram/__tests__/report.pocket.test.ts` | Test untuk `getPocketBalances` |
| Modify | `lib/telegram/report.ts` | Tambah fungsi `getPocketBalances` |
| Modify | `lib/telegram/handler.ts` | Tambah import, case `/saldo`, update `HELP` |

---

## Task 1: Test `getPocketBalances`

**Files:**
- Create: `lib/telegram/__tests__/report.pocket.test.ts`

- [ ] **Step 1.1: Buat file test dengan mock Prisma**

Buat file `lib/telegram/__tests__/report.pocket.test.ts` dengan isi berikut:

```typescript
// lib/telegram/__tests__/report.pocket.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pocket: {
      findMany: vi.fn(),
    },
  },
}));

// report.ts juga import dari date-fns dan date-fns-tz untuk fungsi lain —
// mock modul yang tidak relevan agar test tetap fokus
vi.mock("@/lib/services/budget.service", () => ({
  syncBudgetsForExpenseChange: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getPocketBalances } from "../report";

const mockFindMany = vi.mocked(prisma.pocket.findMany);

beforeEach(() => vi.clearAllMocks());

describe("getPocketBalances", () => {
  it("returns guidance message when user has no pockets", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await getPocketBalances("user-1");
    expect(result).toBe("Belum ada pocket. Buat pocket di website terlebih dahulu.");
  });

  it("returns all pockets when no filter given", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "1000000", transactions: [] },
      { name: "Gopay", initialBalance: "200000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1");
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
    expect(result).toContain("Rp 1.000.000");
    expect(result).toContain("Rp 200.000");
  });

  it("calculates balance as initialBalance + income - expense", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        name: "BCA",
        initialBalance: "1000000",
        transactions: [
          { type: "income", amount: "500000" },
          { type: "expense", amount: "200000" },
        ],
      },
    ] as never);
    const result = await getPocketBalances("user-1");
    // 1000000 + 500000 - 200000 = 1300000
    expect(result).toContain("Rp 1.300.000");
  });

  it("returns single pocket when filter matches exactly one", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
      { name: "Gopay", initialBalance: "100000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "BCA");
    expect(result).toContain("BCA");
    expect(result).not.toContain("Gopay");
  });

  it("filter is case-insensitive", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "bca");
    expect(result).toContain("BCA");
  });

  it("filter matches substring", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA Tabungan", initialBalance: "500000", transactions: [] },
      { name: "Gopay", initialBalance: "100000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "bca");
    expect(result).toContain("BCA Tabungan");
    expect(result).not.toContain("Gopay");
  });

  it("returns list when filter matches multiple pockets", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
      { name: "BCA Dollar", initialBalance: "100000", transactions: [] },
      { name: "Gopay", initialBalance: "200000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "BCA");
    expect(result).toContain("BCA");
    expect(result).toContain("BCA Dollar");
    expect(result).not.toContain("Gopay");
  });

  it("falls back to all pockets with not-found message when filter has no match", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
      { name: "Gopay", initialBalance: "100000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "Dana");
    expect(result).toContain("Dana");
    expect(result).toContain("tidak ditemukan");
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
  });
});
```

- [ ] **Step 1.2: Jalankan test — pastikan FAIL karena fungsi belum ada**

```
npx vitest run lib/telegram/__tests__/report.pocket.test.ts
```

Expected: semua test FAIL dengan error seperti `getPocketBalances is not a function` atau export tidak ditemukan.

- [ ] **Step 1.3: Commit test**

```bash
git add lib/telegram/__tests__/report.pocket.test.ts
git commit -m "test: add failing tests for getPocketBalances"
```

---

## Task 2: Implementasi `getPocketBalances` di `report.ts`

**Files:**
- Modify: `lib/telegram/report.ts`

- [ ] **Step 2.1: Tambah fungsi `getPocketBalances` di akhir `report.ts`**

Tambahkan kode berikut di akhir file `lib/telegram/report.ts` (setelah fungsi `deleteLastTransaction`):

```typescript
export async function getPocketBalances(userId: string, filter?: string): Promise<string> {
  const pockets = await prisma.pocket.findMany({
    where: { userId },
    select: {
      name: true,
      initialBalance: true,
      transactions: {
        select: { type: true, amount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  if (pockets.length === 0) {
    return "Belum ada pocket. Buat pocket di website terlebih dahulu.";
  }

  const computed = pockets.map((p) => {
    let balance = Number(p.initialBalance);
    for (const t of p.transactions) {
      if (t.type === "income") balance += Number(t.amount);
      else balance -= Number(t.amount);
    }
    return { name: p.name, balance };
  });

  const renderList = (items: { name: string; balance: number }[]): string => {
    const lines = ["💼 <b>Saldo Pocket</b>", ""];
    for (const p of items) {
      lines.push(`• ${p.name}: <b>${formatRupiah(p.balance)}</b>`);
    }
    return lines.join("\n");
  };

  if (!filter) {
    return renderList(computed);
  }

  const filterLower = filter.toLowerCase();
  const matched = computed.filter((p) => p.name.toLowerCase().includes(filterLower));

  if (matched.length === 0) {
    return `⚠️ Pocket "${filter}" tidak ditemukan.\n\n${renderList(computed)}`;
  }

  if (matched.length === 1) {
    return `💼 <b>${matched[0].name}</b>\nSaldo: <b>${formatRupiah(matched[0].balance)}</b>`;
  }

  return renderList(matched);
}
```

- [ ] **Step 2.2: Jalankan test — pastikan semua PASS**

```
npx vitest run lib/telegram/__tests__/report.pocket.test.ts
```

Expected: semua test PASS.

- [ ] **Step 2.3: Commit implementasi**

```bash
git add lib/telegram/report.ts
git commit -m "feat: add getPocketBalances to telegram report"
```

---

## Task 3: Update `handler.ts`

**Files:**
- Modify: `lib/telegram/handler.ts`

- [ ] **Step 3.1: Tambah `getPocketBalances` ke import di baris 6–13**

Ubah import dari `./report` di `lib/telegram/handler.ts` (baris 6–13) dari:

```typescript
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getRecentTransactions,
  deleteLastTransaction,
} from "./report";
```

menjadi:

```typescript
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getRecentTransactions,
  deleteLastTransaction,
  getPocketBalances,
} from "./report";
```

- [ ] **Step 3.2: Tambah case `/saldo` di switch statement**

Di `lib/telegram/handler.ts`, dalam fungsi `handleCommand`, di dalam blok `switch (cmd)`, tambahkan case `/saldo` setelah case `/hapus` (sebelum `default`):

```typescript
case "/saldo": {
  const filter = args.join(" ").trim() || undefined;
  await sendMessage(chatId, await getPocketBalances(userId, filter));
  break;
}
```

- [ ] **Step 3.3: Update konstanta `HELP`**

Ubah bagian `HELP` di `lib/telegram/handler.ts` dari:

```typescript
  `<b>Laporan:</b>\n` +
  `/hari · /minggu · /bulan\n` +
  `/bulan 3 · /bulan 3 2025\n\n` +
```

menjadi:

```typescript
  `<b>Laporan:</b>\n` +
  `/hari · /minggu · /bulan\n` +
  `/bulan 3 · /bulan 3 2025\n` +
  `/saldo · /saldo [nama]\n\n` +
```

- [ ] **Step 3.4: Jalankan semua test Telegram untuk memastikan tidak ada regresi**

```
npx vitest run lib/telegram/__tests__
```

Expected: semua test PASS.

- [ ] **Step 3.5: Jalankan lint dan build**

```
npm run lint
npm run build
```

Expected: tidak ada error lint maupun build.

- [ ] **Step 3.6: Commit handler changes**

```bash
git add lib/telegram/handler.ts
git commit -m "feat: add /saldo command to telegram bot"
```

---

## Self-Review

**Spec coverage:**
- ✅ `/saldo` tampil semua pocket → Task 2 (no filter path)
- ✅ `/saldo [nama]` tampil pocket spesifik → Task 2 (filter path)
- ✅ Kalkulasi saldo = initialBalance + income - expense → Task 2 Step 2.1
- ✅ Display minimal (nama + saldo) → Task 2 Step 2.1 `renderList`
- ✅ Substring case-insensitive match → Task 2 Step 2.1
- ✅ Tidak ada match → fallback ke semua + not-found message → Task 2 Step 2.1
- ✅ Handler wiring + HELP update → Task 3
- ✅ Tidak ada perubahan schema/migration → benar, tidak ada task schema

**Placeholder scan:** Tidak ada TBD atau TODO. Semua langkah memiliki kode lengkap.

**Type consistency:** `getPocketBalances(userId: string, filter?: string): Promise<string>` digunakan konsisten di Task 1 (test), Task 2 (implementasi), dan Task 3 (handler call).
