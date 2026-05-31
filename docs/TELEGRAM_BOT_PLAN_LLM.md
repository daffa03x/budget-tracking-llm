# Telegram Budget Bot — Complete Implementation Plan

## Project Overview

Integrasikan Telegram Bot ke website budget tracking Next.js yang sudah ada. Bot memungkinkan user mencatat pemasukan & pengeluaran melalui 3 cara:

1. **Chat teks** — "pengeluaran makan 50rb"
2. **Voice note** — kirim voice note, bot otomatis transkripsi dan catat
3. **Foto struk** — kirim foto struk/receipt, bot baca dan extract transaksi

Semua tersinkron dengan akun website via auth linking.

## Tech Stack

- Framework: Next.js (App Router)
- ORM: Prisma
- Database: PostgreSQL
- Auth: (sesuaikan — NextAuth / Clerk / Supabase Auth / custom)
- STT: Groq Whisper API (free tier)
- LLM + Vision: Google Gemini 2.0 Flash (free tier)

## Architecture

```
Telegram User
  │
  ├── Teks: "pengeluaran makan 50rb"
  ├── Voice: [audio .ogg]
  └── Foto: [image struk]
        │
        ▼
  Telegram Bot API
        │ webhook POST
        ▼
  /api/telegram/webhook (Next.js API Route)
        │
        ▼
  handler.ts (routing berdasarkan tipe pesan)
        │
        ├── Teks ──────────► parser.ts (regex) ──────────────────┐
        │                         │                               │
        │                    gagal parse?                         │
        │                         │ ya                            │
        │                         ▼                               │
        │                    llm.ts (Gemini) ── extract ──────────┤
        │                                                         │
        ├── Voice ─► download .ogg ─► stt.ts (Groq Whisper)      │
        │                                │                        │
        │                           transkripsi teks              │
        │                                │                        │
        │                    ┌── coba parser.ts (regex)           │
        │                    │       │                            │
        │                    │  gagal parse?                      │
        │                    │       │ ya                         │
        │                    │       ▼                            │
        │                    └── llm.ts (Gemini) ── extract ──────┤
        │                                                         │
        ├── Foto ──► download image ─► llm.ts (Gemini Vision)    │
        │                                │                        │
        │                         extract transaksi ──────────────┤
        │                                                         │
        │                                                         ▼
        │                                              { type, amount, category }
        │                                                         │
        │                                                         ▼
        └─── report commands ──► report.ts ──► Prisma ◄── save transaction
                                                  │
                                                  ▼
                                           PostgreSQL
                                                  │
                                                  ▼
                                          Website Dashboard
```

Auth linking flow:

```
Website (logged in)              Telegram
       │                            │
  Klik "Link Telegram"              │
       │                            │
  POST /api/telegram/link           │
  → generate token (15min expiry)   │
  → return deep link                │
       │                            │
  Tampilkan: t.me/bot?start=TOKEN   │
       │                            │
       └─── User klik link ────→ /start TOKEN
                                    │
                              Verifikasi token
                              Link chatId → userId
                                    │
                              ✅ Akun terhubung
```

---

## Prerequisites

Sebelum implementasi, pastikan:

1. Buat bot di Telegram via @BotFather → simpan bot token
2. Catat bot username (tanpa @)
3. Pastikan project Next.js sudah running dan bisa deploy
4. Database PostgreSQL sudah aktif
5. Buat Groq API key di https://console.groq.com (gratis)
6. Buat Google Gemini API key di https://aistudio.google.com/apikey (gratis)

---

## Environment Variables

Tambahkan ke `.env`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=<token dari BotFather>
TELEGRAM_BOT_USERNAME=<username bot tanpa @>
TELEGRAM_WEBHOOK_SECRET=<random string untuk verifikasi webhook>
NEXT_PUBLIC_APP_URL=<production URL, contoh: https://budgetku.vercel.app>

# Groq (Speech-to-Text)
GROQ_API_KEY=<API key dari console.groq.com>

# Google Gemini (LLM + Vision)
GEMINI_API_KEY=<API key dari aistudio.google.com>
```

---

## Implementation Steps

### Step 1: Update Prisma Schema

Tambahkan model `TelegramLink` dan update model `Transaction` (atau buat baru jika belum ada) di `prisma/schema.prisma`.

Model `TelegramLink`:

```prisma
model TelegramLink {
  id          String    @id @default(cuid())
  token       String    @unique
  userId      String
  chatId      String?
  username    String?
  firstName   String?
  linked      Boolean   @default(false)
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId])
  @@index([token])
  @@index([chatId])
}
```

Model `Transaction` — tambahkan field `source` untuk tracking asal input:

```prisma
enum TransactionType {
  INCOME
  EXPENSE
}

enum TransactionSource {
  TEXT
  VOICE
  IMAGE
  WEB
}

model Transaction {
  id              String            @id @default(cuid())
  type            TransactionType
  amount          Float
  category        String
  description     String?
  source          TransactionSource @default(TEXT)
  rawInput        String?           // Simpan input asli untuk debugging
  date            DateTime          @default(now())
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  telegramChatId  String?
  userId          String?

  @@index([telegramChatId])
  @@index([telegramChatId, date])
  @@index([userId])
  @@index([userId, date])
  @@index([date])
}
```

Setelah update schema, jalankan:

```bash
npx prisma migrate dev --name add-telegram-bot
npx prisma generate
```

**Catatan penting**: Jika sudah ada model `Transaction` atau `User`, jangan duplikasi — tambahkan field yang belum ada saja. Pastikan `userId` di `TelegramLink` dan `Transaction` mereferensikan tipe ID yang sama dengan model `User` yang sudah ada.

---

### Step 2: Buat Telegram API Helper

Buat file `src/lib/telegram/api.ts`.

Fungsi yang dibutuhkan:

- `sendMessage(chatId, text, options?)` — Kirim pesan ke Telegram user. Gunakan `fetch()` ke `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`. Default parse_mode: "HTML".
- `setWebhook(url)` — Register webhook URL ke Telegram API. Kirim POST ke `/setWebhook` dengan payload `{ url, allowed_updates: ["message"] }`.
- `deleteWebhook()` — Hapus webhook yang terdaftar.
- `sendChatAction(chatId, action)` — Kirim typing indicator. Action: "typing". Panggil POST ke `/sendChatAction`.
- `getFileUrl(fileId)` — Dapatkan URL download file dari Telegram. Dua langkah: (1) GET `/getFile?file_id={fileId}` → dapat `file_path`, (2) construct URL: `https://api.telegram.org/file/bot${TOKEN}/${file_path}`. Fungsi ini dipakai untuk download voice note dan foto.
- `downloadFile(fileId)` — Panggil `getFileUrl()` lalu `fetch()` URL-nya, return `Buffer`. Ini yang dipakai oleh STT dan vision handler.

---

### Step 3: Buat Message Parser (Regex-based)

Buat file `src/lib/telegram/parser.ts`.

Parser ini menangani format teks terstruktur bahasa Indonesia. Ini adalah "fast path" — jika berhasil, tidak perlu panggil LLM (hemat quota).

**Deteksi tipe transaksi dari keyword awal pesan:**

- EXPENSE keywords: `pengeluaran`, `keluar`, `beli`, `bayar`, `byr`
- INCOME keywords: `pemasukan`, `masuk`, `terima`, `gaji`, `dapat`, `dpt`

**Parse nominal dari berbagai format Indonesia:**

- `50rb` atau `50 rb` → 50.000
- `5jt` atau `5 jt` → 5.000.000
- `2.5jt` atau `2,5jt` → 2.500.000
- `50k` → 50.000
- `1.500.000` (dot sebagai thousand separator) → 1.500.000
- `500000` (plain number) → 500.000

**Extract kategori**: teks antara keyword dan nominal.

Contoh parsing:

| Input | Output |
|---|---|
| `pengeluaran makan siang 50rb` | `{ type: EXPENSE, amount: 50000, category: "Makan Siang" }` |
| `masuk gaji 5jt` | `{ type: INCOME, amount: 5000000, category: "Gaji" }` |
| `beli kopi 25k` | `{ type: EXPENSE, amount: 25000, category: "Kopi" }` |
| `bayar listrik 500.000` | `{ type: EXPENSE, amount: 500000, category: "Listrik" }` |
| `pemasukan freelance 2.5jt` | `{ type: INCOME, amount: 2500000, category: "Freelance" }` |

Juga export fungsi `formatRupiah(amount)` yang format angka ke `Rp50.000` menggunakan `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" })`.

Return `null` jika pesan tidak bisa di-parse (bukan format transaksi yang dikenali).

---

### Step 4: Buat Speech-to-Text Service (Groq Whisper)

Buat file `src/lib/telegram/stt.ts`.

Fungsi utama: `transcribeAudio(audioBuffer: Buffer): Promise<string>`

**Flow:**

1. Terima audio buffer (file `.ogg` dari Telegram)
2. Kirim ke Groq Whisper API via multipart/form-data:
   ```
   POST https://api.groq.com/openai/v1/audio/transcriptions
   Headers:
     Authorization: Bearer ${GROQ_API_KEY}
   Body (multipart/form-data):
     file: <audio buffer> (filename: "audio.ogg", type: "audio/ogg")
     model: "whisper-large-v3-turbo"
     language: "id"
     response_format: "text"
   ```
3. Return teks transkripsi

**Detail implementasi multipart/form-data di Node.js:**

```typescript
const formData = new FormData();
formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "audio.ogg");
formData.append("model", "whisper-large-v3-turbo");
formData.append("language", "id");
formData.append("response_format", "text");

const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
  body: formData,
});

const transcription = await response.text();
```

**Penting:**
- Set `language: "id"` supaya Whisper optimize untuk bahasa Indonesia
- Gunakan model `whisper-large-v3-turbo` (paling akurat, tetap gratis di Groq)
- Response format `text` supaya langsung dapat string, tidak perlu parse JSON
- Handle error: jika Groq down atau rate limited, kirim pesan ke user minta coba lagi
- Groq free tier saat ini: ~28.800 audio detik per hari
- Telegram voice note formatnya `.ogg` (codec: opus) — Groq Whisper mendukung format ini langsung, tidak perlu konversi

---

### Step 5: Buat LLM Service (Google Gemini)

Buat file `src/lib/telegram/llm.ts`.

File ini menangani dua hal: (1) extract transaksi dari teks natural bahasa Indonesia, dan (2) baca foto struk/receipt.

**Penting sebelum implementasi:** Cek dokumentasi Gemini API terbaru di https://ai.google.dev/gemini-api/docs karena endpoint, model name, dan parameter bisa berubah. Gunakan model dan endpoint yang paling update pada saat implementasi.

#### Fungsi 1: `extractTransactionFromText(text: string): Promise<ParsedTransaction | null>`

Untuk teks yang gagal di-parse oleh regex parser (Step 3). Contoh input yang butuh LLM:
- "tadi gue beli kopi di starbucks 50 ribu"
- "abis bayar parkir dua puluh lima ribu"
- "dapat transferan dari client 3 juta"

**Implementasi:**

Kirim request ke Gemini API:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}
Content-Type: application/json

{
  "contents": [{
    "parts": [{
      "text": "<prompt>"
    }]
  }],
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

**Prompt (masukkan dalam field text):**

```
Kamu adalah parser transaksi keuangan. Extract informasi transaksi dari pesan bahasa Indonesia berikut.

Rules:
- Tentukan apakah ini INCOME atau EXPENSE
- Extract nominal dalam angka (bukan string)
- Extract kategori singkat (1-2 kata, capitalize)
- Jika pesan bukan tentang transaksi keuangan, return null
- Angka dalam kata harus dikonversi: "lima puluh ribu" = 50000, "tiga juta" = 3000000, "dua ratus ribu" = 200000, "sejuta" = 1000000, "seratus ribu" = 100000
- Slang: "goceng" = 5000, "ceban" = 10000, "cepek" = 100000

Respond ONLY with JSON, no markdown:
{"type": "INCOME" | "EXPENSE", "amount": number, "category": "string"}

Atau jika bukan transaksi:
null

Pesan: "{text}"
```

**Parse response:** Gemini dengan `responseMimeType: "application/json"` akan return JSON langsung. Parse dengan `JSON.parse()`, validate bahwa hasilnya punya `type`, `amount`, dan `category`. Return `null` jika tidak valid.

#### Fungsi 2: `extractTransactionFromImage(imageBuffer: Buffer, mimeType: string, caption?: string): Promise<ParsedTransaction[]>`

Untuk foto struk/receipt. Return array karena satu struk bisa punya beberapa item.

**Implementasi:**

Kirim request ke Gemini API dengan image:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}
Content-Type: application/json

{
  "contents": [{
    "parts": [
      {
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "<base64 encoded image>"
        }
      },
      {
        "text": "<prompt>"
      }
    ]
  }],
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

**Prompt untuk image:**

```
Kamu adalah pembaca struk/receipt belanja. Analisis foto struk ini dan extract informasi transaksi.

Rules:
- Identifikasi TOTAL PEMBAYARAN (bukan subtotal per-item, kecuali cuma 1 item)
- Untuk struk belanja biasa (supermarket, restoran), cukup 1 transaksi dengan total
- Jika ada beberapa kategori yang jelas berbeda dan terpisah, boleh pisahkan
- Semua transaksi dari struk adalah EXPENSE
- Kategori tentukan dari nama toko atau jenis belanjaan (contoh: "Groceries", "Makan", "Transportasi")
- Jika ada caption dari user, gunakan sebagai hint kategori: "{caption}"
- Jika bukan foto struk/receipt, return array kosong
- Nominal dalam Rupiah (IDR)

Respond ONLY with JSON array, no markdown:
[{"type": "EXPENSE", "amount": number, "category": "string", "description": "string"}]

Atau jika bukan struk:
[]
```

**Handle response:** Parse JSON array. Validate setiap item. Filter yang amount-nya 0 atau negatif.

**Catatan Gemini free tier:**
- Rate limit: 15 RPM (request per minute), 1.500 RPD (request per day)
- Untuk bot personal, ini sangat cukup
- Image max size: 20MB (foto Telegram biasanya < 1MB)
- Supported image types: JPEG, PNG, WebP

---

### Step 6: Buat Report Generator

Buat file `src/lib/telegram/report.ts`.

Fungsi-fungsi yang dibutuhkan:

**`generateDailyReport(chatId)`**
Query transaksi hari ini berdasarkan `telegramChatId`. Return string HTML dengan:
- Total pemasukan dan pengeluaran hari ini
- Saldo (pemasukan - pengeluaran)
- Breakdown per kategori
- Jumlah total transaksi

**`generateWeeklyReport(chatId)`**
Query transaksi minggu ini (Senin-Minggu). Format sama seperti daily tapi range seminggu.

**`generateMonthlyReport(chatId, month?, year?)`**
Query transaksi bulan ini (atau bulan/tahun tertentu jika ada parameter). Tambahkan info rata-rata pengeluaran per hari.

**`getRecentTransactions(chatId, limit = 5)`**
Return N transaksi terakhir dalam format list sederhana, tiap baris berisi tanggal, kategori, nominal, dan source icon (📝 teks, 🎙️ voice, 📷 foto, 🌐 web).

**`deleteLastTransaction(chatId)`**
Hapus transaksi paling terakhir berdasarkan `createdAt` desc. Return konfirmasi apa yang dihapus.

Semua fungsi return string formatted HTML untuk Telegram (gunakan tag `<b>` untuk bold, dll).

---

### Step 7: Buat Main Bot Handler

Buat file `src/lib/telegram/handler.ts`.

Ini adalah routing utama bot. Export satu fungsi `handleUpdate(update)` yang menerima Telegram update object.

**Flow utama berdasarkan tipe pesan:**

#### A. Pesan Teks (`message.text` ada)

1. Jika dimulai `/` → route ke command handler (Step 8)
2. Cek apakah user sudah linked (query `TelegramLink` by chatId) → jika belum, minta link dulu
3. Coba parse dengan regex parser (`parseMessage()` dari parser.ts)
4. Jika regex berhasil → simpan transaksi ke database dengan `source: "TEXT"`, kirim konfirmasi
5. Jika regex gagal → kirim ke LLM (`extractTransactionFromText()` dari llm.ts)
6. Jika LLM berhasil → simpan transaksi dengan `source: "TEXT"`, simpan teks asli di `rawInput`, kirim konfirmasi
7. Jika LLM juga gagal (return null) → kirim pesan bantuan format

#### B. Voice Note (`message.voice` ada)

1. Cek apakah user sudah linked → jika belum, minta link dulu
2. Kirim typing indicator: panggil `sendChatAction(chatId, "typing")`
3. Download file audio: ambil `message.voice.file_id`, panggil `downloadFile()` dari api.ts
4. Kirim audio buffer ke STT: panggil `transcribeAudio()` dari stt.ts
5. Kirim hasil transkripsi ke user sebagai feedback: `🎙️ <i>"hasil transkripsi..."</i>`
6. Coba parse transkripsi dengan regex parser (`parseMessage()`)
7. Jika regex berhasil → simpan transaksi dengan `source: "VOICE"`, simpan transkripsi di `rawInput`
8. Jika regex gagal → kirim transkripsi ke LLM (`extractTransactionFromText()`)
9. Jika LLM berhasil → simpan transaksi dengan `source: "VOICE"`, simpan transkripsi di `rawInput`
10. Jika semua gagal → kirim pesan: "Maaf, saya tidak bisa memahami voice note ini sebagai transaksi. Coba format: pengeluaran [kategori] [nominal]"

#### C. Foto (`message.photo` ada)

1. Cek apakah user sudah linked → jika belum, minta link dulu
2. Kirim typing indicator
3. Ambil foto resolusi tertinggi: `message.photo[message.photo.length - 1].file_id` (Telegram kirim array foto dengan berbagai resolusi, ambil yang terakhir = paling besar)
4. Download foto: panggil `downloadFile()` dari api.ts
5. Convert buffer ke base64: `imageBuffer.toString("base64")`
6. Tentukan mime type dari file extension atau default `image/jpeg`
7. Ambil caption jika ada: `message.caption` (optional)
8. Kirim ke Gemini Vision: panggil `extractTransactionFromImage(base64, mimeType, caption)` dari llm.ts
9. Jika berhasil extract (array tidak kosong):
   - Loop setiap transaksi, simpan ke database dengan `source: "IMAGE"`
   - Kirim ringkasan ke user:
     ```
     📷 Struk terbaca!

     💸 Groceries - Rp150.000
     💸 Household - Rp35.000

     Total: Rp185.000 (2 transaksi dicatat)
     ```
10. Jika return array kosong → kirim: "Maaf, saya tidak bisa membaca foto ini sebagai struk belanja. Pastikan foto struk-nya jelas dan tidak terpotong."

#### D. Pesan tipe lain (sticker, document, location, dll)

Kirim pesan: "Saya hanya bisa memproses teks, voice note, dan foto struk. Ketik /help untuk panduan."

---

### Step 8: Command Handler (bagian dari handler.ts)

| Command | Behavior |
|---|---|
| `/start` (tanpa args) | Welcome message. Cek apakah sudah linked. Sebutkan bahwa bot menerima teks, voice note, dan foto struk |
| `/start TOKEN` | Deep link handler — verifikasi token dari TelegramLink table (lihat flow di bawah) |
| `/help` | Tampilkan panduan lengkap termasuk format teks, voice, dan foto |
| `/hari` | Panggil `generateDailyReport()` |
| `/minggu` | Panggil `generateWeeklyReport()` |
| `/bulan` | Panggil `generateMonthlyReport()`. Terima optional args: `/bulan 3` untuk bulan Maret, `/bulan 3 2025` untuk Maret 2025 |
| `/riwayat` | Panggil `getRecentTransactions()`. Optional: `/riwayat 10` untuk 10 transaksi |
| `/hapus` | Panggil `deleteLastTransaction()` |
| `/status` | Tampilkan status koneksi: linked/not linked, username, tanggal link |

**Deep link verification flow (`/start TOKEN`):**

```
1. Cari token di table TelegramLink
2. Jika tidak ada → kirim "Token tidak valid"
3. Jika expired (expiresAt < now) → kirim "Token expired", hapus record
4. Jika sudah linked → kirim "Token sudah digunakan"
5. Cek apakah chatId ini sudah linked ke akun lain → kirim warning
6. Update record: chatId, username, firstName, linked = true
7. Migrate orphan transactions: UPDATE Transaction SET userId = link.userId
   WHERE telegramChatId = chatId AND userId IS NULL
8. Kirim pesan sukses
```

Semua command selain `/start` dan `/help` harus cek linked status dulu. Jika belum linked, kirim pesan minta hubungkan akun.

---

### Step 9: Buat Webhook API Route

Buat file `src/app/api/telegram/webhook/route.ts`.

**POST handler:**

1. Verifikasi request: cek header `x-telegram-bot-api-secret-token` sama dengan `TELEGRAM_WEBHOOK_SECRET`. Jika tidak cocok → return 401
2. Parse body JSON sebagai Telegram update
3. Panggil `handleUpdate(update)` secara **async tanpa await** — Telegram butuh response cepat. Tangkap error dengan `.catch()`
4. Return `{ ok: true }` dengan status 200

**GET handler:**

Return `{ status: "Bot webhook is active ✅" }` — health check.

**Catatan runtime untuk Vercel:**
Voice note dan foto processing bisa makan waktu 3-10 detik. Pastikan:

```typescript
export const runtime = "nodejs"; // Bukan Edge — perlu handle Buffer
export const maxDuration = 30;   // Vercel Pro: max 300s
```

---

### Step 10: Buat Webhook Setup Route

Buat file `src/app/api/telegram/setup/route.ts`.

**GET handler:**

1. Baca `TELEGRAM_BOT_TOKEN` dan `NEXT_PUBLIC_APP_URL` dari env
2. Construct webhook URL: `${NEXT_PUBLIC_APP_URL}/api/telegram/webhook`
3. POST ke Telegram API `/setWebhook` dengan payload:
   ```json
   {
     "url": "<webhook URL>",
     "allowed_updates": ["message"],
     "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
   }
   ```
4. Return response dari Telegram

Endpoint ini hanya perlu diakses sekali setelah deploy. Buka di browser: `https://domain.com/api/telegram/setup`

---

### Step 11: Buat Linking API Route

Buat file `src/app/api/telegram/link/route.ts`.

**PENTING**: Sesuaikan fungsi get session/user dengan auth library yang dipakai project ini. Cek apakah project pakai NextAuth, Clerk, Supabase Auth, atau custom auth, lalu gunakan method yang sesuai untuk mendapatkan current user session.

**POST — Generate linking token:**

1. Get current authenticated user (dari session/auth)
2. Jika tidak authenticated → return 401
3. Cek apakah user sudah punya link yang aktif (`linked: true`) → return info "sudah terhubung"
4. Generate random token: `crypto.randomBytes(16).toString("hex")`
5. Set expiry: 15 menit dari sekarang
6. Hapus token-token lama yang belum dipakai untuk user ini (`linked: false`)
7. Create record `TelegramLink` dengan token, userId, expiresAt
8. Build deep link: `https://t.me/${BOT_USERNAME}?start=${token}`
9. Return `{ deep_link, expires_in: "15 menit" }`

**GET — Check linking status:**

1. Get current authenticated user
2. Query `TelegramLink` where `userId` + `linked: true`
3. Return `{ linked: boolean, telegram_username, telegram_name, linked_at }`

**DELETE — Unlink Telegram:**

1. Get current authenticated user
2. Delete semua `TelegramLink` records untuk userId tersebut
3. Return `{ success: true }`

---

### Step 12: Buat TelegramLinkCard Component

Buat file `src/components/TelegramLinkCard.tsx` (React client component — `"use client"`).

Component ini ditaruh di halaman settings atau dashboard website.

**State 1 — Belum terhubung:**
- Icon Telegram + judul "Telegram Bot"
- Deskripsi: "Catat keuangan via teks, voice note, dan foto struk"
- Tombol "Hubungkan Telegram" → panggil `POST /api/telegram/link`

**State 2 — Deep link generated:**
- Instruksi: "Klik tombol di bawah untuk membuka Telegram"
- Tombol "Buka di Telegram →" → `<a href={deep_link} target="_blank">`
- Tampilkan link lengkap + tombol copy ke clipboard
- Info: "Link berlaku 15 menit"
- Tombol "Cek Status Koneksi" → panggil `GET /api/telegram/link`

**State 3 — Sudah terhubung:**
- Status indicator hijau: "Terhubung"
- Info: username Telegram, tanggal terhubung
- Tombol "Putuskan Koneksi" → panggil `DELETE /api/telegram/link` dengan window.confirm() dulu

Gunakan styling konsisten dengan design system website (cek Tailwind / CSS modules / styled-components).

---

### Step 13: Integrasi dengan Dashboard Website

Setelah semua file selesai:

1. Tambahkan `<TelegramLinkCard />` ke halaman settings atau dashboard user
2. Pastikan halaman transaksi/laporan di website query berdasarkan `userId` (transaksi dari website maupun Telegram otomatis muncul)
3. Optional: tampilkan icon source pada tiap transaksi (📝/🎙️/📷/🌐)
4. Optional: filter transaksi berdasarkan source

---

## File Structure Summary

```
prisma/
  schema.prisma              ← Tambah TelegramLink, update Transaction, enum Source

src/
  app/
    api/
      telegram/
        webhook/
          route.ts           ← Menerima webhook dari Telegram
        setup/
          route.ts           ← One-time webhook registration
        link/
          route.ts           ← Generate/check/delete auth link
  components/
    TelegramLinkCard.tsx     ← UI component untuk dashboard
  lib/
    telegram/
      api.ts                 ← Telegram API (sendMessage, downloadFile, sendChatAction)
      parser.ts              ← Regex parser untuk teks terstruktur (fast path)
      stt.ts                 ← Speech-to-text via Groq Whisper
      llm.ts                 ← LLM via Gemini (teks natural + vision/struk)
      report.ts              ← Generate laporan keuangan
      handler.ts             ← Main routing (teks, voice, foto, commands)
```

---

## API Rate Limits (Free Tier)

| Service | Limit | Cukup untuk |
|---|---|---|
| Groq Whisper (STT) | ~28.800 detik audio/hari | ~480 voice note per hari |
| Gemini Flash (LLM + Vision) | 15 RPM, 1.500 RPD | ~1.500 transaksi per hari |
| Telegram Bot API | 30 msg/detik | Tidak akan jadi bottleneck |

Untuk bot personal atau beberapa user, limit ini sangat memadai.

---

## Error Handling Strategy

Setiap external API call (Groq, Gemini, Telegram) harus dibungkus try-catch:

- **Groq down / rate limited:** Kirim pesan: "🎙️ Layanan transkripsi sedang sibuk. Coba lagi dalam 1 menit, atau ketik manual."
- **Gemini down / rate limited:** Kirim pesan: "🤖 Layanan AI sedang sibuk. Coba ketik manual: pengeluaran [kategori] [nominal]"
- **Gemini return format tak terduga:** Log error, kirim pesan minta coba lagi
- **File download gagal:** Kirim pesan: "Gagal mengunduh file. Coba kirim ulang."
- **Amount 0 atau negatif:** Reject, minta user cek ulang
- **Voice note > 5 menit:** Tolak, minta kirim lebih pendek (optional, tergantung Groq limit)

Selalu berikan fallback ke manual text entry. Bot harus tetap usable walau Groq/Gemini down.

---

## Testing Checklist

### Core Bot
1. Schema migration berhasil tanpa error
2. Webhook setup: `/api/telegram/setup` → `"ok": true`
3. `/start` → welcome message + instruksi link
4. Generate link di website → muncul deep link
5. Klik deep link → bot kirim "Akun berhasil terhubung"

### Teks
6. Format terstruktur: `pengeluaran makan 50rb` → konfirmasi ✅
7. Format natural: `tadi beli kopi di starbucks lima puluh ribu` → LLM parse → konfirmasi ✅
8. Transaksi muncul di dashboard website
9. Pesan non-transaksi: `halo apa kabar` → panduan format

### Voice Note
10. VN terstruktur: "pengeluaran makan siang lima puluh ribu" → transkripsi + parse → ✅
11. VN natural: "tadi gue beli kopi, bayar lima puluh ribu" → transkripsi + LLM → ✅
12. VN non-transaksi: "halo apa kabar" → tidak bisa extract

### Foto Struk
13. Foto struk jelas → extract total + kategori → ✅
14. Foto struk + caption "belanja bulanan" → caption jadi hint kategori
15. Foto bukan struk → "tidak bisa membaca sebagai struk"

### Laporan & Riwayat
16. `/hari` → ringkasan hari ini
17. `/bulan` → ringkasan bulan ini
18. `/riwayat` → transaksi terakhir dengan icon source
19. `/hapus` → hapus + konfirmasi

### Auth Edge Cases
20. Unlink di website → status berubah
21. Chat setelah unlink → minta link ulang
22. Token expired → "Token expired"
23. Token invalid → "Token tidak valid"

### Error Handling
24. Groq API key salah → bot fallback ke manual input
25. Gemini API key salah → bot fallback ke manual input

---

## Deployment Notes

- `NEXT_PUBLIC_APP_URL` harus HTTPS di production
- Hit `/api/telegram/setup` sekali setelah deploy
- Webhook harus publicly accessible (bukan localhost)
- Development lokal: gunakan ngrok atau cloudflared:
  ```bash
  ngrok http 3000
  # Set NEXT_PUBLIC_APP_URL ke URL ngrok, lalu hit /api/telegram/setup
  ```
- Gunakan Node.js runtime (bukan Edge) untuk webhook route
- Set `maxDuration` minimal 15-30 detik untuk voice/image processing

---

## Future Enhancements (Optional)

- **Konfirmasi sebelum simpan**: Untuk voice/image, kirim preview dengan inline keyboard (✅ Simpan / ❌ Batal / ✏️ Edit) sebelum save ke database
- **Budget alerts**: Notifikasi otomatis jika spending mendekati limit
- **Scheduled reports**: Kirim laporan harian/mingguan otomatis via cron
- **Export CSV**: Command `/export` untuk download data
- **Multi-item receipt**: Breakdown struk per item, bukan hanya total
- **Recurring transactions**: Catat transaksi berulang (langganan, cicilan)
- **Smart categorization**: Belajar dari pattern — auto-assign kategori berdasarkan history user
- **Multi-currency**: Support mata uang selain IDR
