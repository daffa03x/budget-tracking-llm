# Brainstorm Output

## Current Context

Mode discovery: `solution-shaping`.

Project ini adalah Budget Tracking App berbasis Next.js 16, Prisma, NextAuth v5, shadcn/ui, dan PostgreSQL. Dokumentasi membagi area user menjadi dua lapis:

- Phase 2: autentikasi dan manajemen user dasar, yaitu register, login, logout, route protection, session, dan profile API.
- Phase 8: settings, profile, keamanan akun, danger zone, serta sharing/member untuk budget tracking bersama.

Fakta dari codebase saat ini:

- `User` sudah punya `name`, `email`, `image`, `password`, `currency`, `createdAt`, dan `updatedAt`.
- Register, login, profile update, password update, hapus transaksi, dan hapus akun sudah punya service/API pendukung.
- Settings page sudah masuk melalui `components/settings/settings-manager`.
- Ada sharing sederhana berbasis `AccountConnection` dengan status `pending`, `accepted`, dan `rejected`.
- Sharing saat ini memperluas scope data memakai relasi antar user, belum memakai model workspace/member/role seperti rencana dokumentasi Phase 8.

## Problem Framing

User management perlu menjawab dua kebutuhan yang berbeda:

- Pengguna biasa ingin mengelola akun sendiri: profil, email, password, preferensi, dan penghapusan akun/data.
- Pemilik data budget ingin mengatur akses orang lain: mengundang member, menerima/menolak undangan, mencabut akses, dan membatasi hak lihat/edit.

Karena aplikasi ini budget pribadi/keluarga, user management sebaiknya tidak langsung menjadi admin panel global. Nilai utamanya adalah account settings dan shared budget access.

## Target Users

- Primary user: pemilik akun budget tracking yang ingin mengelola identitas, preferensi mata uang, password, dan data pribadinya.
- Shared budget owner: user yang ingin mencatat budget bersama pasangan, keluarga, atau teman serumah.
- Invited member: user yang hanya perlu melihat atau ikut mengedit transaksi/budget sesuai izin.
- Future app admin: operator aplikasi yang mungkin perlu melihat daftar user, status akun, atau metrik penggunaan, tetapi ini bukan kebutuhan MVP.

## Feature Directions

### 1. Account Management MVP

Fokus pada self-service account settings.

- Edit nama, avatar URL, email, dan currency.
- Ganti password dengan current password.
- Hapus semua transaksi dengan konfirmasi.
- Hapus akun dengan password dan konfirmasi.

Tradeoff: paling cepat karena sebagian besar backend sudah ada, tetapi belum menyelesaikan kolaborasi/member.

### 2. Sharing Connections

Melanjutkan fitur `AccountConnection` yang sudah ada.

- Invite user lewat email yang sudah terdaftar.
- Incoming/outgoing invitation.
- Accept/reject invitation.
- Remove connected user.
- Data finansial dari connected user masuk ke scope bersama.

Tradeoff: implementasi ringan dan cocok dengan schema sekarang, tetapi belum ada role, ownership, active workspace, atau permission granular.

### 3. Workspace + Member Role

Mengikuti arah Phase 8 di docs.

- Setiap user punya personal workspace default.
- Owner bisa membuat workspace tambahan.
- Owner/admin bisa invite member.
- Role: owner, admin, editor, viewer.
- Semua data transaksi, kategori, budget, dashboard, dan laporan difilter dengan `workspaceId`.

Tradeoff: paling benar untuk jangka panjang, tetapi menyentuh banyak model dan service karena perlu migrasi dari boundary `userId` ke `workspaceId`.

### 4. Admin User Console

Panel internal untuk mengelola user aplikasi secara global.

- Daftar user.
- Search/filter user.
- Lihat status akun, tanggal daftar, dan ringkasan aktivitas.
- Disable/delete user oleh admin.
- Reset password atau kirim link reset.

Tradeoff: berguna untuk SaaS/admin, tetapi kurang selaras dengan MVP budget tracker pribadi kecuali memang aplikasi ini akan punya operator/admin.

## Recommended MVP

Rekomendasi: mulai dari Account Management + Sharing Connections, lalu rancang jalan migrasi ke Workspace + Member Role.

Scope v1 yang disarankan:

- Rapikan halaman `/settings` menjadi tab: Profile, Security, Sharing, Danger Zone.
- Profile: update nama, email, avatar URL, currency.
- Security: update password.
- Sharing: list koneksi, undang lewat email, accept/reject invitation, remove connection.
- Danger Zone: hapus transaksi dan hapus akun.
- Tampilkan state loading, empty, error, dan toast sukses/gagal.

Out of scope v1:

- Admin panel global.
- Role owner/admin/editor/viewer.
- Workspace selector.
- Transfer ownership.
- Invite token untuk email yang belum terdaftar.
- Email delivery.

Setelah v1 stabil, v2 bisa mengubah sharing menjadi workspace:

- Tambah model `Workspace`, `WorkspaceMember`, dan `WorkspaceInvitation`.
- Tambah `workspaceId` ke `Transaction`, `Budget`, `Category`, dan `Pocket`.
- Buat personal workspace untuk user existing.
- Ubah service agar authorization berbasis membership dan role.
- Tambah `/settings/members` dan active workspace selector.

## Key Risks

- Scope creep: "management user" bisa berarti account settings, member sharing, atau admin global. Perlu dipilih supaya tidak melebar.
- Data boundary: saat ini beberapa service memakai `getFinancialScopeUserIds`; workspace v2 akan mengubah cara akses data secara luas.
- Permission bug: role/member harus divalidasi di server, bukan hanya disembunyikan di UI.
- Email change: sudah memerlukan current password, tetapi jika nanti ada email verification perlu flow tambahan.
- Account deletion: perlu memastikan cascade Prisma tidak menyisakan data yang tidak bisa diakses.
- Sharing privacy: koneksi dua arah membuat data bisa tercampur; user harus paham siapa yang punya akses ke data finansialnya.

## Assumptions

- Yang dimaksud "management user" adalah pengelolaan akun dan member sharing di dalam app budget tracker, bukan admin panel superuser.
- Aplikasi masih MVP/small-team, jadi email delivery dan role granular bisa ditunda.
- User yang diundang sudah punya akun terlebih dahulu pada v1.
- Sharing v1 boleh memakai `AccountConnection` yang sudah ada sebelum migrasi workspace.

## Open Questions

- Apakah kamu ingin user management untuk pengguna biasa, admin aplikasi, atau member sharing keluarga/tim?
- Apakah sharing harus punya role sejak awal, atau cukup connected user dulu?
- Apakah orang yang belum punya akun boleh diundang lewat email?
- Apakah data yang dibagikan harus seluruh data finansial atau hanya budget book/workspace tertentu?
- Apakah app ini single-user personal finance, family finance, atau SaaS multi-user?

## Next Step

Artifact terbaik berikutnya: `tech-plan-lite` untuk mengubah rekomendasi MVP menjadi kontrak teknis.

Rencana teknis berikutnya sebaiknya memutuskan:

- Route UI final untuk `/settings` dan `/settings/members`.
- API contract untuk sharing/account actions.
- Apakah tetap memakai `AccountConnection` atau langsung migrasi ke workspace.
- Perubahan Prisma yang dibutuhkan.
- Urutan implementasi dan verifikasi.

## Implementation Status

Implemented v1 scope:

- Settings page organized into tabs: Profile, Security, Sharing, and Danger Zone.
- Profile tab covers name, email, avatar URL, and currency preference.
- Security tab covers password update and active session display.
- Sharing tab covers connected accounts, invite by email, incoming invitation accept/reject, outgoing invitation cancel, and connection removal.
- Danger Zone covers transaction deletion and account deletion.
- Sharing data is loaded on the server for `/settings` and hydrated into TanStack Query as initial data.

Deferred:

- Admin panel global.
- Workspace/member role model.
- Email delivery and invitation tokens for emails that are not registered.
- Active workspace selector and role-based permissions.
