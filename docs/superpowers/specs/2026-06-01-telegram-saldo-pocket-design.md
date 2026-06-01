---
name: telegram-saldo-pocket
description: Design spec untuk command /saldo di Telegram Bot — cek saldo pocket dengan filter substring
metadata:
  type: project
---

# Telegram Bot: Command `/saldo` — Cek Saldo Pocket

**Date:** 2026-06-01  
**Status:** Approved  
**Parent spec:** `docs/superpowers/specs/2026-05-31-telegram-bot-design.md`

---

## Overview

Tambah command `/saldo` ke Telegram Bot yang memungkinkan user melihat saldo semua pocket atau pocket tertentu langsung dari Telegram. Tidak ada perubahan schema — semua data sudah tersedia di model `Pocket` dan `Transaction`.

---

## Ruang Lingkup

- Tambah fungsi `getPocketBalances` di `lib/telegram/report.ts`
- Tambah case `/saldo` di `lib/telegram/handler.ts`
- Update konstanta `HELP` di `handler.ts`
- Tidak ada perubahan schema, migration, API route, atau UI

---

## Section 1: Kalkulasi Saldo

Saldo pocket dihitung dari data yang sudah ada:

```
saldo = pocket.initialBalance
      + SUM(transactions WHERE pocketId = pocket.id AND type = "income")
      - SUM(transactions WHERE pocketId = pocket.id AND type = "expense")
```

Query menggunakan `prisma.pocket.findMany` dengan `include._count` atau aggregasi via `groupBy` pada `Transaction`. Semua query difilter by `userId` untuk memastikan data ownership.

---

## Section 2: Fungsi `getPocketBalances`

**File:** `lib/telegram/report.ts`

**Signature:**
```typescript
export async function getPocketBalances(userId: string, filter?: string): Promise<string>
```

**Logika:**

1. Fetch semua pocket milik `userId` beserta aggregate income dan expense dari transaksi terkait.
2. Hitung saldo tiap pocket: `initialBalance + totalIncome - totalExpense`.
3. Jika `filter` diberikan:
   - Cari pocket yang namanya mengandung `filter` (case-insensitive, substring match).
   - Jika ada satu match → tampilkan saldo pocket itu saja.
   - Jika ada lebih dari satu match → tampilkan daftar semua yang match.
   - Jika tidak ada match → tampilkan semua pocket dengan pesan bahwa pocket tidak ditemukan.
4. Jika tidak ada pocket sama sekali → tampilkan pesan panduan buat pocket di website.

**Contoh output `/saldo` (semua pocket):**
```
💼 <b>Saldo Pocket</b>

• BCA      : Rp 2.450.000
• Gopay    : Rp   180.000
• Cash     : Rp   500.000
```

**Contoh output `/saldo bca` (satu match):**
```
💼 <b>BCA</b>
Saldo: <b>Rp 2.450.000</b>
```

**Contoh output `/saldo dana` (tidak ditemukan, fallback ke semua):**
```
⚠️ Pocket "dana" tidak ditemukan.

💼 <b>Saldo Pocket</b>

• BCA      : Rp 2.450.000
• Gopay    : Rp   180.000
• Cash     : Rp   500.000
```

**Contoh output jika belum ada pocket:**
```
Belum ada pocket. Buat pocket di website terlebih dahulu.
```

---

## Section 3: Handler

**File:** `lib/telegram/handler.ts`

Tambah import `getPocketBalances` dari `./report`.

Tambah case di `switch (cmd)` dalam `handleCommand`:

```typescript
case "/saldo": {
  const filter = args.join(" ").trim() || undefined;
  await sendMessage(chatId, await getPocketBalances(userId, filter));
  break;
}
```

Update konstanta `HELP` — tambahkan `/saldo · /saldo [nama]` di baris Laporan:

```
<b>Laporan:</b>
/hari · /minggu · /bulan
/bulan 3 · /bulan 3 2025
/saldo · /saldo [nama]
```

---

## Error Handling

| Skenario | Response |
|---|---|
| User belum linked | Sudah ditangani di `handleCommand` sebelum masuk switch |
| Tidak ada pocket | "Belum ada pocket. Buat pocket di website terlebih dahulu." |
| Pocket tidak ditemukan (filter) | Tampilkan pesan tidak ditemukan + fallback semua pocket |
| Database error | Bubble up ke try/catch di `handleUpdate` |

---

## File yang Berubah

```
lib/telegram/report.ts     ← tambah fungsi getPocketBalances
lib/telegram/handler.ts    ← tambah case /saldo, update HELP, tambah import
```

---

## Out of Scope

- Breakdown transaksi per pocket
- Top-up / transfer antar pocket via bot
- Notifikasi saldo rendah
- Perubahan schema atau migration
