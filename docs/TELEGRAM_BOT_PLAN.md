# Telegram Budget Bot - Implementation Plan

Dokumen ini adalah plan implementasi teknis untuk fitur Telegram Bot pada aplikasi Budget Tracking. Referensi utama: `docs/TELEGRAM_BOT_PLAN_LLM.md`.

Bot memungkinkan user mencatat transaksi dari Telegram melalui teks, voice note, dan foto struk. Semua transaksi harus tersinkron ke akun website melalui proses linking yang aman.

## Product Goal

User dapat mencatat pemasukan dan pengeluaran tanpa membuka website, terutama saat sedang mobile atau setelah transaksi terjadi. Website tetap menjadi tempat utama untuk melihat dashboard, mengelola kategori, budget, report, dan settings.

## Scope MVP

Masuk MVP:

- Link akun website dengan chat Telegram memakai deep link token.
- Catat transaksi dari teks terstruktur, misalnya `pengeluaran makan 50rb`.
- Catat transaksi dari teks natural dengan fallback LLM.
- Catat transaksi dari voice note melalui transkripsi.
- Catat transaksi dari foto struk melalui vision extraction.
- Command report dasar: `/hari`, `/minggu`, `/bulan`, `/riwayat`, `/hapus`, `/status`, `/help`.
- Integrasi transaksi Telegram ke dashboard dan halaman transaksi website.
- UI card di settings untuk hubungkan, cek status, dan putuskan Telegram.

Di luar MVP:

- Inline keyboard untuk review sebelum simpan.
- Scheduled report otomatis.
- Budget alert otomatis via Telegram.
- Export CSV dari Telegram.
- Multi-item receipt yang detail per item.
- Smart categorization berbasis histori jangka panjang.

## Product Assumptions

- Aplikasi utama sudah punya auth, transaksi, kategori, dashboard, dan settings dasar.
- User yang memakai bot adalah user yang sudah punya akun website.
- Mata uang awal adalah IDR.
- Telegram dipakai sebagai input cepat, bukan sebagai pengganti seluruh dashboard.
- Kategori dari bot boleh berupa kategori existing jika match, atau fallback ke deskripsi/kategori sederhana sesuai aturan service transaksi.

## Technical Assumptions

- Project memakai Next.js 16 App Router.
- Sebelum implementasi route handler Next.js, baca guide relevan di `node_modules/next/dist/docs/`.
- Auth memakai NextAuth v5 sesuai arah project.
- Database memakai Prisma dan PostgreSQL.
- Money value mengikuti pola project yang sudah ada, terutama Decimal-compatible handling.
- Semua data finansial harus ditulis memakai service layer, bukan langsung dari route/handler bot.
- User boundary diambil dari session/link record, bukan dari input client.
- Jika workspace/shared budget sudah aktif, Telegram transaction harus masuk ke workspace aktif/default user sesuai aturan product yang disepakati.

## Environment Variables

Tambahkan ke `.env` dan environment production:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=

# Speech-to-text
GROQ_API_KEY=

# LLM and Vision
GEMINI_API_KEY=
```

Catatan:

- `TELEGRAM_WEBHOOK_SECRET` harus random dan tidak dibagikan ke client.
- `NEXT_PUBLIC_APP_URL` harus HTTPS di production.
- `GROQ_API_KEY` dan `GEMINI_API_KEY` hanya boleh dipakai server-side.

## Architecture

```txt
Telegram App
  |
  | text / voice / photo / command
  v
Telegram Bot API
  |
  | webhook POST
  v
app/api/telegram/webhook/route.ts
  |
  v
lib/telegram/handler.ts
  |
  |-- command handler
  |-- text parser fast path
  |-- voice download -> STT -> parser/LLM
  |-- image download -> Gemini Vision
  v
lib/services/transaction.service.ts
  |
  v
Prisma / PostgreSQL
  |
  v
Website dashboard, transactions, reports
```

Auth linking:

```txt
Website settings
  |
  | POST /api/telegram/link
  v
Create short-lived token
  |
  v
https://t.me/<bot>?start=<token>
  |
  v
Telegram /start TOKEN
  |
  v
Verify token, expiry, ownership, and chat binding
  |
  v
TelegramLink linked to userId
```

## Data Model Plan

### Add `TelegramLink`

Use this model as the account-to-chat binding. Adjust relation fields to match the existing `User` model.

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

### Update `Transaction`

Do not duplicate the existing model. Add only fields that are missing.

Recommended additions:

```prisma
enum TransactionSource {
  WEB
  TELEGRAM_TEXT
  TELEGRAM_VOICE
  TELEGRAM_IMAGE
}
```

Recommended transaction fields:

```prisma
source         TransactionSource @default(WEB)
rawInput       String?
telegramChatId String?
telegramLinkId String?
```

Recommended indexes:

```prisma
@@index([telegramChatId])
@@index([userId, source])
@@index([userId, date])
```

If the app already uses `workspaceId`, add indexes that match the real query path:

```prisma
@@index([workspaceId, source])
@@index([workspaceId, date])
```

## Backend Modules

### `lib/telegram/api.ts`

Responsibilities:

- `sendMessage(chatId, text, options?)`
- `sendChatAction(chatId, action)`
- `setWebhook(url)`
- `deleteWebhook()`
- `getFileUrl(fileId)`
- `downloadFile(fileId)`

Rules:

- Use Telegram Bot API with `TELEGRAM_BOT_TOKEN`.
- Default `parse_mode` can be `HTML`, but escape user-controlled text before rendering it as HTML.
- External calls must be wrapped with useful error handling.

### `lib/telegram/parser.ts`

Responsibilities:

- Parse structured Indonesian transaction text without AI.
- Export `parseTelegramTransaction(text)`.
- Export `formatRupiah(amount)`.

Supported examples:

| Input | Expected result |
|---|---|
| `pengeluaran makan siang 50rb` | expense, 50000, Makan Siang |
| `masuk gaji 5jt` | income, 5000000, Gaji |
| `beli kopi 25k` | expense, 25000, Kopi |
| `bayar listrik 500.000` | expense, 500000, Listrik |
| `pemasukan freelance 2.5jt` | income, 2500000, Freelance |

Parsing rules:

- Expense keywords: `pengeluaran`, `keluar`, `beli`, `bayar`, `byr`.
- Income keywords: `pemasukan`, `masuk`, `terima`, `gaji`, `dapat`, `dpt`.
- Amount formats: `rb`, `k`, `jt`, decimal comma/dot, thousand separator dot, plain number.
- Return `null` when text is not a recognizable transaction.

### `lib/telegram/stt.ts`

Responsibilities:

- `transcribeAudio(audioBuffer: Buffer): Promise<string>`.
- Send Telegram `.ogg` voice notes to Groq Whisper.
- Use Indonesian language hint.
- Return plain transcription text.

Implementation notes:

- Use server-side `FormData`.
- Prefer model from current Groq documentation at implementation time.
- Handle wrong key, rate limit, and unavailable service with fallback message.

### `lib/telegram/llm.ts`

Responsibilities:

- `extractTransactionFromText(text)`.
- `extractTransactionsFromImage(imageBuffer, mimeType, caption?)`.

Rules:

- Validate all model output before saving.
- Reject zero or negative amount.
- Return `null` or empty array when extraction is uncertain.
- Use JSON response mode when available.
- Before implementation, verify current Gemini model names and API request format from official docs.

Text extraction output shape:

```ts
type ParsedTelegramTransaction = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  description?: string;
};
```

Image extraction output shape:

```ts
type ParsedTelegramReceiptItem = {
  type: "EXPENSE";
  amount: number;
  category: string;
  description?: string;
};
```

### `lib/telegram/report.ts`

Responsibilities:

- `generateDailyReport(chatId)`
- `generateWeeklyReport(chatId)`
- `generateMonthlyReport(chatId, month?, year?)`
- `getRecentTransactions(chatId, limit?)`
- `deleteLastTransaction(chatId)`

Rules:

- Resolve `chatId` to linked user/workspace first.
- Query through service layer where possible.
- Enforce data ownership.
- Return Telegram-safe HTML strings.

### `lib/telegram/handler.ts`

Responsibilities:

- Route Telegram updates by message type.
- Handle commands.
- Check link status before processing protected actions.
- Save transactions through transaction service.
- Send confirmation or fallback help text.

Message flow:

1. Extract `chatId`, `from`, and message content.
2. If text starts with `/`, route to command handler.
3. For non-command messages, require linked account.
4. Text: parser first, LLM fallback second.
5. Voice: download, transcribe, parser first, LLM fallback second.
6. Photo: download highest resolution image, pass to vision extraction.
7. Save valid transaction(s).
8. Respond with compact confirmation.

## API Route Plan

### `app/api/telegram/webhook/route.ts`

Methods:

- `POST`: receive Telegram webhook.
- `GET`: health check.

Rules:

- Use Node.js runtime because voice/image needs Buffer.
- Verify `x-telegram-bot-api-secret-token`.
- Parse update JSON.
- Return quickly with `{ ok: true }`.
- Start update processing without blocking the webhook response, but catch and log errors.

Expected route config:

```ts
export const runtime = "nodejs";
export const maxDuration = 30;
```

### `app/api/telegram/setup/route.ts`

Methods:

- `GET`: register webhook with Telegram.

Rules:

- Restrict this endpoint. At minimum require an admin secret query/header or only enable in trusted deployment workflow.
- Use `NEXT_PUBLIC_APP_URL` to build webhook URL.
- Pass `secret_token` to Telegram.

### `app/api/telegram/link/route.ts`

Methods:

- `POST`: generate short-lived Telegram deep link for authenticated user.
- `GET`: check linked status for authenticated user.
- `DELETE`: unlink Telegram for authenticated user.

Rules:

- Use server session, never client-supplied `userId`.
- Token expiry: 15 minutes.
- Delete older unused tokens for the same user.
- Prevent one chat from being linked to multiple active users unless explicitly supported.

## Command Plan

| Command | Behavior |
|---|---|
| `/start` | Welcome message and current link status |
| `/start TOKEN` | Verify deep link token and link chat to user |
| `/help` | Supported input formats and command list |
| `/hari` | Today's income, expense, net, category breakdown |
| `/minggu` | Current week report |
| `/bulan` | Current month report |
| `/bulan 3` | March report for current year |
| `/bulan 3 2026` | March 2026 report |
| `/riwayat` | Last 5 transactions |
| `/riwayat 10` | Last 10 transactions |
| `/hapus` | Delete most recent Telegram-visible transaction |
| `/status` | Link status and Telegram account info |

All commands except `/start` and `/help` require linked account.

## Website UI Plan

Add a `TelegramLinkCard` to settings, or to dashboard only if settings is not ready.

States:

- Not linked: explain value, show "Hubungkan Telegram".
- Link generated: show deep link button, copy link action, expiry info, and check status button.
- Linked: show status, username/name, linked date, and unlink action.
- Error/loading: clear retry path.

Expected API interactions:

- `GET /api/telegram/link` on mount.
- `POST /api/telegram/link` on connect.
- `DELETE /api/telegram/link` on unlink after confirmation.

## Transaction Save Rules

Every Telegram-created transaction must include:

- `userId` from `TelegramLink`.
- `workspaceId` if the app requires workspace ownership.
- `type`, `amount`, `date`, and category/categoryId according to existing transaction schema.
- `source`.
- `rawInput` for text and voice.
- `telegramChatId`.

Category handling priority:

1. Match existing user/workspace category by normalized name and type.
2. Use default category mapping if available.
3. Use a safe fallback category such as `Lainnya`.
4. Store extracted category text in description or metadata if category relation is required.

## Error Handling

User-facing errors should be short and actionable.

Recommended fallbacks:

- Parser failed: show examples.
- Groq failed: ask user to type manually.
- Gemini failed: ask user to use structured format.
- File download failed: ask user to resend.
- Invalid amount: ask user to check nominal.
- Unlinked chat: ask user to connect from website settings.
- Expired token: ask user to generate a new link.

Do not expose stack traces, API keys, provider payloads, or server env values.

## Security Checklist

- Webhook verifies Telegram secret token.
- Linking token is random, unique, short-lived, and one-time use.
- Link/unlink routes require authenticated session.
- Bot never trusts Telegram username as app identity.
- Bot never accepts `userId` from message text.
- All transaction writes use service-layer ownership rules.
- External API errors are logged server-side only.
- Server-only env vars are not imported in client components.
- Optional but recommended: rate-limit Telegram webhook per chatId.

## File Structure

```txt
app/
  api/
    telegram/
      link/
        route.ts
      setup/
        route.ts
      webhook/
        route.ts

components/
  settings/
    TelegramLinkCard.tsx

lib/
  telegram/
    api.ts
    handler.ts
    llm.ts
    parser.ts
    report.ts
    stt.ts
    types.ts

lib/
  services/
    telegram-link.service.ts
    transaction.service.ts

lib/
  validations/
    telegram.schema.ts
```

Adjust paths to match the existing project structure.

## Testing Plan

Unit tests:

- Parser amount formats.
- Parser type and category extraction.
- LLM response validation.
- Link token expiry logic.
- Report date range helpers.

Service tests:

- Create transaction from linked Telegram chat.
- Reject unlinked chat.
- Delete last transaction only within current user/workspace boundary.
- Prevent chatId collision across active links.

Manual integration tests:

- `/start` without token.
- Generate link from settings.
- Open deep link and verify success.
- Send structured text transaction.
- Send natural language text transaction.
- Send voice note transaction.
- Send clear receipt photo.
- Send non-receipt photo.
- Run report commands.
- Unlink account and confirm bot requires linking again.

Deployment tests:

- `npm run lint`.
- `npm run build`.
- Prisma migration/generate if schema changes.
- Register webhook with production HTTPS URL.
- Confirm Telegram setup returns `ok: true`.

## Rollout Plan

1. Enable for local development with ngrok/cloudflared.
2. Test on one internal account.
3. Deploy with webhook setup route protected.
4. Enable for a small set of real users.
5. Monitor failed parses, provider errors, and duplicate transactions.
6. Add confirmation flow only if false positives are frequent.

## Implementation Order

Follow `docs/TELEGRAM_BOT_PHASES.md` for the phase checklist. The recommended vertical slice order is:

1. Data model and migrations.
2. Telegram API helper and webhook shell.
3. Account linking API and settings UI.
4. Text transaction parser and transaction save.
5. Report commands.
6. Voice note support.
7. Receipt photo support.
8. Error handling, tests, deployment hardening.
