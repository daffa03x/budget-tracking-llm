# Telegram Budget Bot - Development Phases

Dokumen ini membagi pengembangan Telegram Bot menjadi phase yang bisa dieksekusi bertahap. Referensi utama: `docs/TELEGRAM_BOT_PLAN_LLM.md` dan `docs/TELEGRAM_BOT_PLAN.md`.

## Relationship To Main Product Roadmap

Telegram Bot adalah extension dari core Budget Tracking, bukan pengganti modul utama. Implementasi paling aman dilakukan setelah modul berikut tersedia:

- Phase 2 main app: Auth dan user management.
- Phase 3 main app: Categories, minimal default category.
- Phase 4 main app: Transactions service dan API.
- Phase 6 main app: Dashboard membaca transaksi user/workspace.
- Phase 8 main app: Settings, atau minimal tempat untuk card link Telegram.

Jika transaksi, auth, atau settings belum selesai, kerjakan bagian dependency itu lebih dulu atau buat slice minimal yang tidak mematahkan ownership rules.

## MVP Priority

Urutan MVP Telegram Bot:

1. Link akun website ke Telegram.
2. Catat transaksi via teks terstruktur.
3. Tampilkan report dan riwayat dasar.
4. Tambahkan AI fallback untuk teks natural.
5. Tambahkan voice note.
6. Tambahkan foto struk.
7. Polish, observability, dan deployment hardening.

## Phase TB-0 - Discovery And Readiness

Tujuan: memastikan integration point utama sudah jelas sebelum coding.

### Checklist

- [ ] Baca `docs/TELEGRAM_BOT_PLAN_LLM.md`.
- [ ] Baca `docs/TELEGRAM_BOT_PLAN.md`.
- [ ] Cek schema Prisma aktual untuk `User`, `Transaction`, `Category`, dan `Workspace` jika ada.
- [ ] Cek service transaksi aktual dan cara membuat transaksi dari server.
- [ ] Cek auth helper aktual untuk mengambil current user.
- [ ] Cek halaman settings/dashboard yang cocok untuk `TelegramLinkCard`.
- [ ] Baca guide Next.js 16 yang relevan di `node_modules/next/dist/docs/` sebelum menulis route handler.
- [ ] Tentukan strategi kategori untuk hasil parser bot.
- [ ] Tentukan workspace target untuk transaksi Telegram jika app sudah mendukung workspace.

### Output

- Keputusan integration point.
- Catatan dependency yang belum siap.
- Draft env var yang diperlukan.

### Exit Criteria

- Developer tahu file mana yang akan disentuh.
- Tidak ada asumsi tersembunyi soal auth, ownership, atau schema transaksi.

## Phase TB-1 - Data Model And Foundation

Tujuan: menyiapkan persistence dan tipe data untuk Telegram link dan transaction source.

### Data/API Agent Checklist

- [ ] Tambahkan model `TelegramLink`.
- [ ] Tambahkan enum/source field untuk transaksi dari web, Telegram text, Telegram voice, dan Telegram image.
- [ ] Tambahkan `rawInput`, `telegramChatId`, dan field pendukung lain jika sesuai schema.
- [ ] Tambahkan relation ke `User`.
- [ ] Tambahkan index untuk lookup link by token, chatId, dan userId.
- [ ] Tambahkan migration.
- [ ] Jalankan Prisma generate.

### Quality Agent Checklist

- [ ] Pastikan model tidak menduplikasi `Transaction` yang sudah ada.
- [ ] Pastikan Decimal/money handling mengikuti pola project.
- [ ] Pastikan cascade/delete behavior aman untuk unlink dan delete user.

### Output

- Prisma schema siap untuk linking dan source tracking.
- Migration siap dijalankan.

### Exit Criteria

- `npx prisma generate` berhasil.
- Schema tidak membuka jalur client untuk menulis `userId` sembarang.

## Phase TB-2 - Telegram Webhook Shell And API Helper

Tujuan: membuat bot bisa menerima webhook dan mengirim response dasar.

### Data/API Agent Checklist

- [ ] Buat `lib/telegram/api.ts`.
- [ ] Implement `sendMessage`.
- [ ] Implement `sendChatAction`.
- [ ] Implement `setWebhook`.
- [ ] Implement `deleteWebhook`.
- [ ] Implement `getFileUrl`.
- [ ] Implement `downloadFile`.
- [ ] Buat `app/api/telegram/webhook/route.ts`.
- [ ] Verifikasi header `x-telegram-bot-api-secret-token`.
- [ ] Buat health check `GET`.
- [ ] Buat `app/api/telegram/setup/route.ts`.
- [ ] Lindungi setup route dengan admin secret atau mekanisme trusted.

### Quality Agent Checklist

- [ ] Route memakai Node.js runtime.
- [ ] Webhook response cepat.
- [ ] Error eksternal tidak membocorkan secret.
- [ ] Env var divalidasi server-side.

### Output

- Webhook route aktif.
- Bot bisa membalas `/start` statis atau ping sederhana.

### Exit Criteria

- Telegram webhook bisa didaftarkan.
- Request dengan secret salah ditolak.
- Request dengan secret benar diterima.

## Phase TB-3 - Account Linking

Tujuan: user website bisa menghubungkan akun dengan chat Telegram secara aman.

### Data/API Agent Checklist

- [ ] Buat `telegram-link.service.ts` atau service setara.
- [ ] Implement generate token 15 menit.
- [ ] Hapus token lama yang belum dipakai untuk user yang sama.
- [ ] Implement verify token dari `/start TOKEN`.
- [ ] Cegah token dipakai ulang.
- [ ] Cegah chatId aktif dipakai akun lain tanpa aturan eksplisit.
- [ ] Implement unlink.
- [ ] Implement status lookup.
- [ ] Buat `app/api/telegram/link/route.ts` untuk `POST`, `GET`, dan `DELETE`.

### Frontend Agent Checklist

- [ ] Buat `TelegramLinkCard`.
- [ ] State belum terhubung.
- [ ] State link generated.
- [ ] State sudah terhubung.
- [ ] Loading, error, retry, dan unlink confirmation.
- [ ] Tempatkan card di settings atau dashboard.

### Quality Agent Checklist

- [ ] Semua route link memakai session user.
- [ ] Deep link tidak berisi data sensitif selain token sekali pakai.
- [ ] Token expired menghasilkan pesan jelas.
- [ ] Unlink membuat chat tidak bisa mencatat transaksi lagi.

### Output

- User bisa link dan unlink Telegram dari website.
- Bot bisa mengenali chat yang sudah linked.

### Exit Criteria

- Flow website -> deep link -> `/start TOKEN` berhasil.
- `/status` menampilkan status yang benar.

## Phase TB-4 - Text Transaction MVP

Tujuan: bot bisa mencatat transaksi dari teks terstruktur tanpa AI.

### Data/API Agent Checklist

- [ ] Buat `lib/telegram/parser.ts`.
- [ ] Support keyword expense dan income.
- [ ] Support nominal `rb`, `k`, `jt`, decimal, thousand separator, dan angka polos.
- [ ] Return `null` untuk non-transaksi.
- [ ] Integrasikan parser ke `handler.ts`.
- [ ] Save transaction melalui service transaksi existing.
- [ ] Simpan `source = TELEGRAM_TEXT`.
- [ ] Simpan `rawInput`.

### Product/Phase Agent Checklist

- [ ] Tentukan fallback kategori jika kategori tidak match.
- [ ] Tentukan format konfirmasi transaksi.
- [ ] Tentukan format bantuan saat parse gagal.

### Quality Agent Checklist

- [ ] Unit test parser untuk nominal Indonesia.
- [ ] Unit test parse gagal.
- [ ] Pastikan unlinked chat tidak bisa save.
- [ ] Pastikan transaksi muncul di dashboard website.

### Output

- User bisa kirim `pengeluaran makan 50rb` dan transaksi tersimpan.

### Exit Criteria

- Structured text berhasil untuk expense dan income.
- Pesan non-transaksi tidak tersimpan.

## Phase TB-5 - Commands And Reports

Tujuan: user bisa melihat ringkasan dan menghapus transaksi terakhir dari Telegram.

### Data/API Agent Checklist

- [ ] Buat `lib/telegram/report.ts`.
- [ ] Implement `/hari`.
- [ ] Implement `/minggu`.
- [ ] Implement `/bulan`.
- [ ] Implement `/riwayat`.
- [ ] Implement `/hapus`.
- [ ] Implement `/help`.
- [ ] Implement `/status`.

### Quality Agent Checklist

- [ ] Report query memakai linked user/workspace boundary.
- [ ] `/hapus` hanya menghapus transaksi milik user/workspace terkait.
- [ ] Limit `/riwayat` dibatasi agar pesan tidak terlalu panjang.
- [ ] Output Telegram HTML aman dari unescaped user input.

### Output

- Bot mendukung command operasional dasar.

### Exit Criteria

- Report harian, mingguan, bulanan, riwayat, dan hapus berjalan untuk akun linked.
- Command protected menolak akun yang belum linked.

## Phase TB-6 - LLM Text Fallback

Tujuan: bot bisa memahami teks natural yang gagal diproses parser.

### Data/API Agent Checklist

- [ ] Buat `lib/telegram/llm.ts`.
- [ ] Implement `extractTransactionFromText`.
- [ ] Validasi response model dengan schema runtime.
- [ ] Integrasikan fallback setelah parser gagal.
- [ ] Simpan `source = TELEGRAM_TEXT`.
- [ ] Simpan `rawInput` asli.

### Quality Agent Checklist

- [ ] Handle Gemini unavailable/rate limited.
- [ ] Reject response tidak valid.
- [ ] Reject amount <= 0.
- [ ] Tambahkan test untuk validator response.
- [ ] Log parse failure server-side tanpa data sensitif berlebihan.

### Output

- User bisa kirim teks natural seperti `tadi beli kopi lima puluh ribu`.

### Exit Criteria

- Parser tetap menjadi fast path.
- LLM hanya dipanggil saat parser gagal.
- Bot tetap usable saat LLM gagal.

## Phase TB-7 - Voice Note Support

Tujuan: user bisa mencatat transaksi dengan voice note.

### Data/API Agent Checklist

- [ ] Buat `lib/telegram/stt.ts`.
- [ ] Download voice note via Telegram file API.
- [ ] Transcribe audio dengan Groq Whisper.
- [ ] Parse hasil transkripsi dengan parser.
- [ ] Fallback ke LLM jika parser gagal.
- [ ] Simpan `source = TELEGRAM_VOICE`.
- [ ] Simpan transkripsi di `rawInput`.

### Product/Phase Agent Checklist

- [ ] Tentukan batas durasi voice note.
- [ ] Tentukan format feedback transkripsi ke user.
- [ ] Tentukan fallback saat transkripsi tidak jelas.

### Quality Agent Checklist

- [ ] Handle file download gagal.
- [ ] Handle STT unavailable/rate limited.
- [ ] Batasi durasi/ukuran jika diperlukan.
- [ ] Pastikan webhook tidak timeout.

### Output

- User bisa mengirim voice note dan transaksi tersimpan.

### Exit Criteria

- Voice note transaksi berhasil.
- Voice note non-transaksi tidak tersimpan.
- Error STT memberi fallback manual.

## Phase TB-8 - Receipt Photo Support

Tujuan: user bisa mencatat transaksi expense dari foto struk.

### Data/API Agent Checklist

- [ ] Ambil foto resolusi tertinggi dari message photo.
- [ ] Download file image.
- [ ] Deteksi/atur mime type.
- [ ] Implement `extractTransactionsFromImage`.
- [ ] Validasi array hasil vision.
- [ ] Simpan setiap transaksi valid dengan `source = TELEGRAM_IMAGE`.
- [ ] Gunakan caption sebagai hint kategori/deskripsi.

### Product/Phase Agent Checklist

- [ ] Untuk MVP, simpan total struk sebagai satu transaksi.
- [ ] Multi-kategori hanya jika hasil jelas dan valid.
- [ ] Tentukan copy saat foto bukan struk.

### Quality Agent Checklist

- [ ] Handle foto blur/bukan struk.
- [ ] Handle Gemini unavailable/rate limited.
- [ ] Reject amount <= 0.
- [ ] Cegah duplikasi akibat retry jika memungkinkan.

### Output

- User bisa upload foto struk dan bot menyimpan expense.

### Exit Criteria

- Foto struk jelas menghasilkan minimal satu transaksi.
- Foto non-struk tidak tersimpan.

## Phase TB-9 - Website Integration Polish

Tujuan: transaksi Telegram terasa natural di website.

### Frontend Agent Checklist

- [ ] Tampilkan source transaksi di tabel/detail jika berguna.
- [ ] Tambahkan filter source jika scope memungkinkan.
- [ ] Pastikan dashboard menghitung transaksi Telegram.
- [ ] Pastikan report/export website mencakup transaksi Telegram.
- [ ] Pastikan `TelegramLinkCard` responsif.

### Data/API Agent Checklist

- [ ] Pastikan query dashboard/report tidak mengecualikan source Telegram.
- [ ] Pastikan category mapping konsisten.
- [ ] Pastikan unlink tidak menghapus transaksi historis kecuali diputuskan product.

### Quality Agent Checklist

- [ ] Loading, error, empty state pada card.
- [ ] Manual regression untuk transaksi website dan Telegram.
- [ ] Accessibility check ringan untuk settings card.

### Output

- Website menampilkan data Telegram dengan jelas.

### Exit Criteria

- User bisa memahami transaksi mana yang dibuat dari Telegram.
- Tidak ada regresi transaksi website.

## Phase TB-10 - Hardening, Testing, And Deployment

Tujuan: fitur siap dipakai di production.

### Quality Agent Checklist

- [ ] `npm run lint`.
- [ ] `npm run build`.
- [ ] Prisma migrate/generate setelah schema change.
- [ ] Unit test parser.
- [ ] Unit test token/link service.
- [ ] Unit test validator LLM response.
- [ ] Integration test service transaksi Telegram jika test setup tersedia.
- [ ] Manual test webhook production.
- [ ] Manual test token expired dan token invalid.
- [ ] Manual test provider key salah untuk Groq/Gemini.
- [ ] Audit env var production.
- [ ] Setup webhook dengan HTTPS production URL.

### Security Checklist

- [ ] Webhook secret aktif.
- [ ] Setup route terlindungi.
- [ ] Link route terlindungi session.
- [ ] API keys tidak masuk client bundle.
- [ ] Log tidak mencetak token atau full secret.
- [ ] Ownership user/workspace dites.
- [ ] External request timeout/retry policy jelas.

### Output

- Telegram Bot siap production.

### Exit Criteria

- Build sukses.
- Webhook production aktif.
- End-to-end happy path berhasil: link account, text transaction, report, unlink.

## Suggested Timeline

| Phase | Name | Estimate |
|---|---|---|
| TB-0 | Discovery and readiness | 0.5 day |
| TB-1 | Data model and foundation | 0.5-1 day |
| TB-2 | Webhook shell and API helper | 0.5-1 day |
| TB-3 | Account linking | 1-2 days |
| TB-4 | Text transaction MVP | 1 day |
| TB-5 | Commands and reports | 1 day |
| TB-6 | LLM text fallback | 0.5-1 day |
| TB-7 | Voice note support | 1 day |
| TB-8 | Receipt photo support | 1 day |
| TB-9 | Website polish | 0.5-1 day |
| TB-10 | Hardening and deployment | 1-2 days |
| Total | MVP with AI, voice, image | 8-12 days |

## Release Milestones

### Milestone 1 - Private Alpha

Includes:

- TB-1 through TB-4.
- Linking.
- Structured text transaction.
- Basic manual verification.

Use when:

- You want the smallest useful bot quickly.

### Milestone 2 - Practical Daily Use

Includes:

- TB-5 and TB-6.
- Reports.
- Natural text fallback.
- Better error handling.

Use when:

- You want the bot to handle real daily input without strict format.

### Milestone 3 - Rich Capture

Includes:

- TB-7 and TB-8.
- Voice notes.
- Receipt photos.

Use when:

- You want Telegram to become the fastest capture channel.

### Milestone 4 - Production Ready

Includes:

- TB-9 and TB-10.
- Website polish.
- Tests.
- Deployment hardening.

Use when:

- You are ready to expose the bot beyond a single internal tester.

## Implementation Notes

- Keep every phase as a vertical slice: schema, service, route, handler, UI, verification.
- Prefer existing services over direct Prisma calls from bot handler.
- Parser must run before LLM to reduce cost and latency.
- Voice and image processing should degrade gracefully to manual text input.
- The bot should confirm what it saved, but MVP does not need approval buttons before save.
- If false positives appear during alpha, add a confirmation step before expanding usage.
