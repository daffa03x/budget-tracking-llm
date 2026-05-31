# Telegram Budget Bot — Design Spec

**Date:** 2026-05-31  
**Status:** Approved  
**Source spec:** `docs/TELEGRAM_BOT_PLAN_LLM.md`

---

## Overview

Integrasi Telegram Bot ke website budget tracking Next.js yang sudah ada. Bot memungkinkan user mencatat pemasukan & pengeluaran melalui tiga cara: teks, voice note, dan foto struk. Semua transaksi tersinkron dengan akun website via auth linking yang bersifat permanent (linked sekali, berlaku selamanya sampai user unlink).

---

## Tech Stack

| Layer | Pilihan |
|---|---|
| Framework | Next.js (App Router) |
| ORM | Prisma + PostgreSQL |
| Auth | NextAuth v5 (JWT, sudah ada di `lib/auth.ts`) |
| STT | Groq Whisper API (`whisper-large-v3-turbo`) |
| LLM + Vision | Google Gemini 2.0 Flash |

---

## Architecture

```
Telegram User
  ├── Teks: "pengeluaran makan 50rb"
  ├── Voice: [audio .ogg]
  └── Foto: [image struk]
        │
        ▼
  /api/telegram/webhook (Next.js, nodejs runtime)
        │
        ▼
  lib/telegram/handler.ts
        │
        ├── Teks ──► parser.ts (regex fast-path)
        │                 │ gagal?
        │                 ▼
        │            llm.ts (Gemini text)
        │
        ├── Voice ──► stt.ts (Groq Whisper) ──► parser.ts ──► llm.ts
        │
        └── Foto ──► llm.ts (Gemini Vision)
                          │
                          ▼
                    resolver.ts (category + pocket lookup/create)
                          │
                          ▼
                    transaction.service.ts (existing)
                          │
                          ▼
                    PostgreSQL → Website Dashboard
```

### Auth Linking Flow

```
Website (logged in) → POST /api/telegram/link → token (15 menit)
                    → deep link t.me/BOT?start=TOKEN

Telegram → /start TOKEN → verifikasi → chatId disimpan permanent
                        → linked = true (berlaku selamanya)

Unlink → DELETE /api/telegram/link → record dihapus
```

---

## Environment Variables

Tambahkan ke `.env`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
GROQ_API_KEY=
GEMINI_API_KEY=
```

---

## Section 1: Schema Changes

### Model baru: `TelegramLink`

```prisma
model TelegramLink {
  id        String    @id @default(cuid())
  token     String    @unique
  userId    String
  chatId    String?
  username  String?
  firstName String?
  linked    Boolean   @default(false)
  expiresAt DateTime  // hanya untuk token deep link (15 menit), bukan untuk linked state
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([chatId])
}
```

### Update model `Transaction`

Tambahkan enum dan field baru:

```prisma
enum TransactionSource {
  web
  text
  voice
  image
}

// Fields baru di Transaction:
source         TransactionSource @default(web)
rawInput       String?
telegramChatId String?
```

Konvensi enum lowercase konsisten dengan `income`/`expense` yang sudah ada. Default `web` memastikan semua transaksi existing dan baru dari website ter-set otomatis tanpa update migration data.

### Update model `User`

```prisma
telegramLinks TelegramLink[]
```

### Migration

```bash
npx prisma migrate dev --name add-telegram-bot
npx prisma generate
```

---

## Section 2: lib/telegram Layer

### `lib/telegram/api.ts` — Telegram Bot API wrapper

| Fungsi | Deskripsi |
|---|---|
| `sendMessage(chatId, text, options?)` | POST ke Telegram, parse_mode HTML default |
| `sendChatAction(chatId, action)` | Kirim typing indicator |
| `getFileUrl(fileId)` | GET `/getFile` → construct download URL |
| `downloadFile(fileId): Promise<Buffer>` | Download voice/foto dari Telegram |

### `lib/telegram/parser.ts` — Regex fast-path

Menangani format teks terstruktur bahasa Indonesia tanpa LLM (hemat quota):

- **Expense keywords:** `pengeluaran`, `keluar`, `beli`, `bayar`, `byr`
- **Income keywords:** `pemasukan`, `masuk`, `terima`, `gaji`, `dapat`, `dpt`
- **Nominal formats:** `50rb` → 50.000, `5jt` → 5.000.000, `2.5jt` → 2.500.000, `50k` → 50.000, `1.500.000` → 1.500.000
- **Pocket detection:** teks setelah keyword `dari` atau `ke` hanya dianggap pocket jika teks tersebut match nama pocket user (case-insensitive). Jika tidak match, diabaikan — tidak error. Contoh valid: "pengeluaran makan 50rb dari BCA" (jika user punya pocket "BCA")
- Return `ParsedTransaction | null`
- Export `formatRupiah(amount)` — dipakai di semua response bot

### `lib/telegram/stt.ts` — Groq Whisper STT

```typescript
transcribeAudio(buffer: Buffer): Promise<string>
// POST multipart ke Groq, model: whisper-large-v3-turbo, language: id
```

### `lib/telegram/llm.ts` — Google Gemini

```typescript
extractTransactionFromText(text: string): Promise<ParsedTransaction | null>
// Fallback untuk teks natural yang gagal di-parse regex

extractTransactionFromImage(base64: string, mimeType: string, caption?: string): Promise<ParsedTransaction[]>
// Baca struk/receipt, return array (satu struk bisa multi-item)
```

Semua response Gemini menggunakan `responseMimeType: "application/json"` agar tidak perlu strip markdown.

### `lib/telegram/resolver.ts` — Category & Pocket resolution *(tambahan)*

```typescript
resolveCategory(userId: string, name: string, type: "income" | "expense"): Promise<string>
// Cari kategori by name (case-insensitive), buat baru jika tidak ada
// Return categoryId

resolvePocket(userId: string, name: string): Promise<string | null>
// Cari pocket by name (case-insensitive), return null jika tidak ketemu
// Tidak buat otomatis
```

Dipisah dari handler agar testable dan reusable. Tidak ada di spec asli tapi diperlukan karena existing system pakai relasi foreign key (bukan teks bebas).

### `lib/telegram/report.ts` — Laporan keuangan

Query by `telegramChatId`, semua return string HTML untuk Telegram:

| Fungsi | Keterangan |
|---|---|
| `generateDailyReport(chatId)` | Ringkasan hari ini |
| `generateWeeklyReport(chatId)` | Ringkasan minggu ini (Senin-Minggu) |
| `generateMonthlyReport(chatId, month?, year?)` | Ringkasan bulan (default bulan ini) |
| `getRecentTransactions(chatId, limit)` | N transaksi terakhir dengan icon source |
| `deleteLastTransaction(chatId)` | Hapus transaksi terakhir, return konfirmasi |

### `lib/telegram/handler.ts` — Main router

`handleUpdate(update)` dispatch ke handler berdasarkan tipe pesan:

**Teks:**
1. Command (`/`) → command handler
2. Cek linked status → minta link jika belum
3. `parseMessage()` (regex) → kalau null, `extractTransactionFromText()` (LLM)
4. `resolveCategory()` + `resolvePocket()` → `createTransaction()` dengan `source: "text"`

**Voice:**
1. Cek linked → typing indicator → `downloadFile()` → `transcribeAudio()`
2. Kirim feedback transkripsi ke user
3. `parseMessage()` → LLM fallback → `createTransaction()` dengan `source: "voice"`, `rawInput: transkripsi`

**Foto:**
1. Cek linked → typing indicator → `downloadFile()` ambil resolusi tertinggi
2. Convert ke base64 → `extractTransactionFromImage()` → loop simpan semua transaksi dengan `source: "image"`

**Command handler:**

| Command | Behavior |
|---|---|
| `/start` | Welcome + instruksi. Jika ada TOKEN → verifikasi + linking |
| `/help` | Panduan lengkap |
| `/hari` | `generateDailyReport()` |
| `/minggu` | `generateWeeklyReport()` |
| `/bulan [n] [yyyy]` | `generateMonthlyReport()` |
| `/riwayat [n]` | `getRecentTransactions()` |
| `/hapus` | `deleteLastTransaction()` |
| `/status` | Status linked: username, tanggal link |

**Deep link `/start TOKEN` flow:**
1. Cari token di TelegramLink
2. Validasi: exists → not expired → not already used
3. Update record: `chatId`, `username`, `firstName`, `linked: true`
4. Kirim pesan sukses

---

## Section 3: API Routes

### `app/api/telegram/webhook/route.ts`

```typescript
export const runtime = "nodejs";
export const maxDuration = 30;

// POST: verifikasi x-telegram-bot-api-secret-token → handleUpdate() tanpa await → return { ok: true }
// GET: health check
```

### `app/api/telegram/setup/route.ts`

```typescript
// GET: register webhook ke Telegram API (one-time, akses di browser setelah deploy)
// Payload: { url, allowed_updates: ["message"], secret_token }
```

### `app/api/telegram/link/route.ts`

```typescript
// POST: generate token (crypto.randomBytes(16).toString("hex")), 15 menit expiry
//       return { deep_link, expires_in: "15 menit" }
// GET:  return { linked, telegram_username, telegram_name, linked_at }
// DELETE: hapus semua TelegramLink records untuk userId → unlink
```

Semua endpoint gunakan `auth()` dari `lib/auth.ts`.

---

## Section 4: UI Component

### `components/telegram/telegram-link-card.tsx`

`"use client"` component, 3 state:

| State | UI |
|---|---|
| Belum linked | Tombol "Hubungkan Telegram" |
| Link generated | Deep link + tombol copy + "Cek Status" + info "berlaku 15 menit" |
| Sudah linked | Badge hijau + username + tanggal + tombol "Putuskan Koneksi" (dengan confirm) |

Styling: shadcn/ui + Tailwind, konsisten dengan design system existing.

### Integrasi Settings

Tambahkan `TelegramLinkCard` ke `app/(dashboard)/settings/page.tsx`. Fetch initial link status di server component, pass sebagai prop ke client component.

---

## Section 5: Existing Code Updates

### `app/api/transactions/route.ts`

Field `source` sudah punya default `web` di schema, tidak perlu update eksplisit. Tidak ada breaking change.

### `lib/services/transaction.service.ts`

`createTransaction()` sudah menerima `TransactionInput` — perlu extend schema validasi untuk menerima `source`, `rawInput`, `telegramChatId` sebagai optional fields (dipakai oleh bot handler, bukan dari web form).

Buat fungsi terpisah `createTransactionFromBot(userId, input)` di service untuk menghindari modifikasi `transactionSchema` Zod yang dipakai web forms.

---

## Category & Pocket Resolution Logic

### Category

```
1. Cari di categories user: WHERE userId = userId AND LOWER(name) = LOWER(extractedName)
2. Kalau tidak ada, cari di default categories: WHERE isDefault = true AND LOWER(name) = LOWER(extractedName)
3. Kalau masih tidak ada, buat baru: CREATE Category { userId, name, type }
4. Return categoryId
```

### Pocket

```
1. Cari: WHERE userId = userId AND LOWER(name) LIKE LOWER(mentionedName)
2. Kalau tidak ketemu → pocketId = null (tidak error, tidak buat otomatis)
3. Return pocketId | null
```

---

## Error Handling

| Skenario | Response ke User |
|---|---|
| Groq down/rate limited | "🎙️ Layanan transkripsi sedang sibuk. Coba ketik manual." |
| Gemini down/rate limited | "🤖 Layanan AI sedang sibuk. Coba format: pengeluaran [kategori] [nominal]" |
| File download gagal | "Gagal mengunduh file. Coba kirim ulang." |
| Amount 0 atau negatif | Reject, minta cek ulang |
| Foto bukan struk | "Tidak bisa membaca sebagai struk. Pastikan foto jelas." |
| Belum linked | Kirim instruksi cara link akun |

Selalu ada fallback ke manual text entry.

---

## File Structure

```
prisma/
  schema.prisma                    ← TelegramLink + Transaction fields

app/api/telegram/
  webhook/route.ts                 ← Webhook receiver (nodejs, maxDuration 30)
  setup/route.ts                   ← One-time webhook registration
  link/route.ts                    ← POST/GET/DELETE linking API

components/telegram/
  telegram-link-card.tsx           ← Settings UI component

lib/telegram/
  api.ts                           ← Telegram Bot API wrapper
  parser.ts                        ← Regex fast-path + formatRupiah
  stt.ts                           ← Groq Whisper STT
  llm.ts                           ← Gemini text + vision
  resolver.ts                      ← Category & pocket resolution
  report.ts                        ← Report generators
  handler.ts                       ← Main update router + commands
```

---

## API Rate Limits (Free Tier)

| Service | Limit | Cukup untuk |
|---|---|---|
| Groq Whisper | ~28.800 detik audio/hari | ~480 voice note/hari |
| Gemini Flash | 15 RPM, 1.500 RPD | ~1.500 transaksi/hari |
| Telegram Bot API | 30 msg/detik | Tidak bottleneck |

---

## Deployment

1. Set semua env vars
2. Deploy ke Vercel (atau host dengan HTTPS)
3. Buka `GET /api/telegram/setup` sekali untuk register webhook
4. Development lokal: gunakan ngrok → set `NEXT_PUBLIC_APP_URL` → hit setup endpoint

---

## Out of Scope

- Konfirmasi sebelum simpan (inline keyboard ✅/❌)
- Budget alerts otomatis
- Scheduled reports (cron)
- Export CSV via `/export`
- Multi-currency
- Recurring transactions
