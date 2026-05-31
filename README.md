# Budget Tracking

Budget Tracking adalah website fullstack untuk mengelola keuangan pribadi. Aplikasi ini membantu user mencatat pemasukan dan pengeluaran, memisahkan saldo ke beberapa kantong, mengatur kategori, membuat budget per kategori, membaca dashboard ringkas, mengekspor laporan, dan mengelola profil akun.

Dokumentasi ini menggantikan README bawaan Next.js dan menjadi panduan utama untuk memahami, menjalankan, dan mengembangkan repository ini.

## Daftar Isi

- [Status Proyek](#status-proyek)
- [Fitur Utama](#fitur-utama)
- [Alur Pengguna](#alur-pengguna)
- [Stack Teknologi](#stack-teknologi)
- [Route Website](#route-website)
- [API Routes](#api-routes)
- [Arsitektur Aplikasi](#arsitektur-aplikasi)
- [Model Data](#model-data)
- [Setup Lokal](#setup-lokal)
- [Environment Variables](#environment-variables)
- [Database dan Prisma](#database-dan-prisma)
- [Script NPM](#script-npm)
- [Struktur Folder](#struktur-folder)
- [Aturan Keamanan dan Data](#aturan-keamanan-dan-data)
- [Roadmap](#roadmap)

## Status Proyek

Repository ini adalah aplikasi Next.js 16 fullstack dengan App Router. Modul yang sudah tersedia di struktur kode:

- Autentikasi register, login, logout, dan proteksi route.
- Dashboard ringkasan keuangan.
- CRUD transaksi dengan filter dan pagination.
- CRUD kantong/sumber dana.
- CRUD kategori default dan kustom.
- CRUD budget dengan progress dan alert ambang batas.
- Laporan bulanan, kategori, tren, dan export CSV.
- Settings akun, profil, preferensi mata uang, password, sharing akun, dan danger zone.

Dokumen perencanaan produk ada di:

- `docs/budget-tracker-modules.md`
- `docs/budget-tracker-phases.md`

Catatan penting: proyek memakai Next.js 16. Sebelum mengubah API, route handler, metadata, cache, middleware/proxy, atau konvensi App Router, baca panduan lokal di `node_modules/next/dist/docs/` karena versi ini dapat berbeda dari pola Next.js lama.

## Fitur Utama

### 1. Auth dan User Management

- Register akun dengan nama, email, password, dan konfirmasi password.
- Login memakai NextAuth v5 Credentials Provider.
- Password di-hash dengan `bcryptjs`.
- Session memakai JWT strategy dan menyimpan `id`, `email`, `name`, `image`, serta `currency`.
- Route dashboard dilindungi oleh `proxy.ts` yang mengekspor `auth` dari NextAuth.
- User yang belum login diarahkan ke `/login`.
- User yang sudah login diarahkan keluar dari halaman `/login` dan `/register` ke dashboard.

### 2. Dashboard

Dashboard adalah halaman utama setelah login. Data diambil dari service report dan ditampilkan sebagai:

- Total pemasukan bulan terpilih.
- Total pengeluaran bulan terpilih.
- Saldo bersih.
- Jumlah transaksi.
- Grafik pemasukan vs pengeluaran 6 bulan terakhir.
- Pengeluaran per kategori.
- Transaksi terbaru.
- Ringkasan budget aktif.
- Selector bulan dan tahun melalui query `month` dan `year`.

### 3. Transaksi

Modul transaksi adalah fitur inti aplikasi.

Kemampuan utama:

- Tambah, edit, dan hapus transaksi.
- Tipe transaksi: `income` dan `expense`.
- Field transaksi: nominal, tipe, deskripsi, tanggal, kategori, dan kantong.
- Filter berdasarkan:
  - tanggal mulai,
  - tanggal akhir,
  - tipe transaksi,
  - kategori,
  - kantong,
  - pencarian deskripsi/kategori/kantong.
- Pagination.
- Summary sesuai filter aktif:
  - total pemasukan,
  - total pengeluaran,
  - saldo bersih,
  - jumlah transaksi.
- Export CSV berdasarkan filter aktif.
- Sinkronisasi pemakaian budget saat transaksi expense dibuat, diubah, atau dihapus.

### 4. Kantong

Kantong dipakai untuk memisahkan sumber dana, misalnya kas, rekening bank, e-wallet, atau tabungan.

Kemampuan utama:

- Tambah, edit, dan hapus kantong.
- Field kantong: nama, ikon, warna, dan saldo awal.
- Hitung saldo saat ini dari saldo awal + pemasukan - pengeluaran.
- Hitung total pemasukan, pengeluaran, dan jumlah transaksi per kantong.
- Filter tampilan:
  - semua,
  - ada transaksi,
  - kosong,
  - minus.
- Kantong dapat dipilih saat membuat transaksi.

### 5. Kategori

Kategori membantu mengelompokkan pemasukan dan pengeluaran.

Kemampuan utama:

- Menampilkan kategori default dan kategori kustom user.
- Tambah, edit, dan hapus kategori kustom.
- Field kategori: nama, ikon, warna, dan tipe.
- Tipe kategori: `income`, `expense`, atau `both`.
- Filter tampilan berdasarkan tipe kategori.
- Kategori default berasal dari seed database dan tidak diperlakukan seperti kategori user biasa.
- Kategori yang sedang dipakai transaksi/budget memiliki perlindungan deletion di service layer.

### 6. Budget

Budget dipakai untuk membuat batas pengeluaran per kategori dan periode.

Kemampuan utama:

- Tambah, edit, dan hapus budget.
- Field budget: limit, periode, tanggal mulai, tanggal akhir, dan kategori.
- Periode: `weekly`, `monthly`, atau `yearly`.
- Hitung `spent` dari transaksi expense pada kategori dan rentang tanggal budget.
- Progress pemakaian dalam persentase.
- Status waktu:
  - `active`,
  - `upcoming`,
  - `expired`.
- Status pemakaian:
  - normal,
  - warning saat mencapai 80%,
  - exceeded saat mencapai 100%.
- Toast alert saat budget mendekati atau melewati limit.

### 7. Laporan dan Export

Modul laporan dipakai untuk analisis lebih panjang daripada dashboard.

Kemampuan utama:

- Filter tahun, bulan awal, bulan akhir, dan kategori.
- Tab laporan:
  - Bulanan,
  - Per Kategori,
  - Tren.
- Stat ringkasan periode:
  - total pemasukan,
  - total pengeluaran,
  - saldo bersih,
  - jumlah transaksi.
- Grafik bar bulanan.
- Grafik bar kategori.
- Grafik line tren tahunan.
- Tabel ringkasan bulanan.
- Export CSV transaksi sesuai filter laporan.

### 8. Settings, Profil, dan Preferensi

Settings berisi pengelolaan akun dan data pribadi.

Tab tersedia:

- Profile:
  - ubah nama,
  - ubah email dengan konfirmasi email baru dan password saat ini,
  - ubah URL avatar.
- Preferences:
  - pilih mata uang default: `IDR`, `USD`, `EUR`, `SGD`, atau `JPY`.
- Security:
  - ganti password,
  - lihat informasi sesi aktif.
- Sharing:
  - undang akun lain berdasarkan email,
  - terima/tolak undangan koneksi,
  - batalkan undangan terkirim,
  - putuskan koneksi akun.
- Danger Zone:
  - hapus semua transaksi,
  - hapus akun beserta data finansial.

### 9. Sharing Akun

Implementasi sharing saat ini memakai model `AccountConnection`, bukan workspace role-based sharing.

Ketika dua akun terhubung dengan status `accepted`, data finansial yang dibaca oleh dashboard, transaksi, kategori, kantong, budget, dan laporan dapat memakai financial scope gabungan dari user sendiri dan partner yang terkoneksi.

Status koneksi:

- `pending`
- `accepted`
- `rejected`

Service utama:

- `getFinancialScopeUserIds(userId)`
- `getSharingOverview(userId)`
- `createSharingInvitation(userId, input)`
- `acceptSharingInvitation(id, userId)`
- `rejectSharingInvitation(id, userId)`
- `deleteSharingConnection(id, userId)`

## Alur Pengguna

1. User membuka website dan masuk ke `/login` atau `/register`.
2. Setelah login, user diarahkan ke dashboard `/`.
3. User membuat kategori dan kantong jika ingin klasifikasi lebih rapi.
4. User mencatat transaksi pemasukan atau pengeluaran.
5. Jika transaksi expense masuk ke kategori yang punya budget aktif, pemakaian budget disinkronkan.
6. User memantau ringkasan di dashboard.
7. User membuka laporan untuk analisis periode tertentu atau export CSV.
8. User mengatur profil, mata uang, password, sharing akun, atau penghapusan data di settings.

## Stack Teknologi

| Area | Teknologi |
|---|---|
| Framework | Next.js 16.2.6 App Router |
| Runtime UI | React 19.2.4, React DOM 19.2.4 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn, Radix Slot, class-variance-authority, lucide-react |
| Auth | NextAuth v5 beta, `@auth/prisma-adapter` |
| Database | PostgreSQL |
| ORM | Prisma 7, `@prisma/adapter-pg`, `pg` |
| Forms | React Hook Form |
| Validation | Zod 4 |
| Data Fetching | TanStack Query 5 |
| Charts | Recharts 3 |
| Notifications | Sonner |
| Date Utility | date-fns |
| Password Hashing | bcryptjs |
| CSV Export | Utility internal di `lib/utils/export.ts` |

## Route Website

| Route | Modul | Keterangan |
|---|---|---|
| `/login` | Auth | Halaman login |
| `/register` | Auth | Halaman register |
| `/` | Dashboard | Ringkasan keuangan |
| `/transactions` | Transaksi | CRUD transaksi |
| `/transaksi` | Transaksi | Alias Indonesia untuk `/transactions` |
| `/pockets` | Kantong | CRUD kantong |
| `/kantong` | Kantong | Alias Indonesia untuk `/pockets` |
| `/categories` | Kategori | CRUD kategori |
| `/budgets` | Budget | CRUD budget |
| `/reports` | Laporan | Analitik dan export |
| `/settings` | Settings | Profil, security, sharing, danger zone |

Navigasi utama didefinisikan di `components/layout/dashboard-shell.tsx`.

## API Routes

Semua API finansial harus dipanggil oleh user yang sudah login. `userId` tidak dipercaya dari client; server mengambil user aktif dari session.

### Auth

| Route | Method | Keterangan |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | Handler NextAuth |

### User

| Route | Method | Keterangan |
|---|---|---|
| `/api/user` | DELETE | Hapus akun user |
| `/api/user/profile` | GET, PATCH | Ambil dan update profil |
| `/api/user/password` | PATCH | Ganti password |
| `/api/user/transactions` | DELETE | Hapus semua transaksi user |

### Transactions

| Route | Method | Keterangan |
|---|---|---|
| `/api/transactions` | GET | List transaksi dengan filter dan pagination |
| `/api/transactions` | POST | Buat transaksi |
| `/api/transactions/[id]` | GET | Detail transaksi |
| `/api/transactions/[id]` | PATCH | Update transaksi |
| `/api/transactions/[id]` | DELETE | Hapus transaksi |

Query list transaksi yang didukung:

- `page`
- `limit`
- `type`
- `categoryId`
- `pocketId`
- `startDate`
- `endDate`
- `search`

### Pockets

| Route | Method | Keterangan |
|---|---|---|
| `/api/pockets` | GET | List kantong |
| `/api/pockets` | POST | Buat kantong |
| `/api/pockets/[id]` | PATCH | Update kantong |
| `/api/pockets/[id]` | DELETE | Hapus kantong |

### Categories

| Route | Method | Keterangan |
|---|---|---|
| `/api/categories` | GET | List kategori default dan kustom |
| `/api/categories` | POST | Buat kategori |
| `/api/categories/[id]` | PATCH | Update kategori |
| `/api/categories/[id]` | DELETE | Hapus kategori |

### Budgets

| Route | Method | Keterangan |
|---|---|---|
| `/api/budgets` | GET | List budget |
| `/api/budgets` | POST | Buat budget |
| `/api/budgets/[id]` | GET | Detail budget |
| `/api/budgets/[id]` | PATCH | Update budget |
| `/api/budgets/[id]` | DELETE | Hapus budget |

### Reports

| Route | Method | Keterangan |
|---|---|---|
| `/api/reports/summary` | GET | Summary bulanan |
| `/api/reports/monthly` | GET | Data laporan bulanan |
| `/api/reports/category` | GET | Breakdown pengeluaran per kategori |
| `/api/reports/export` | GET | Export transaksi ke CSV |

Query umum laporan:

- `year`
- `startMonth`
- `endMonth`
- `month`
- `categoryId`
- `pocketId`
- `type`
- `search`
- `startDate`
- `endDate`

### Sharing

| Route | Method | Keterangan |
|---|---|---|
| `/api/sharing` | GET | Overview koneksi sharing |
| `/api/sharing` | POST | Kirim undangan koneksi |
| `/api/sharing/[id]` | PATCH | Terima atau tolak undangan |
| `/api/sharing/[id]` | DELETE | Hapus atau batalkan koneksi |

## Arsitektur Aplikasi

Pola utama aplikasi:

- `app/` menyimpan route, page, layout, dan API route handlers.
- `components/` menyimpan UI reusable dan feature components.
- `hooks/` menyimpan TanStack Query hooks untuk client fetching dan mutation.
- `lib/services/` menyimpan business logic.
- `lib/validations/` menyimpan Zod schema untuk input form, query, dan API.
- `lib/prisma.ts` menyimpan Prisma client singleton.
- `lib/auth.ts` menyimpan konfigurasi NextAuth.
- `lib/session.ts` menyimpan helper session server-side.
- `prisma/` menyimpan schema, migrations, dan seed.

Prinsip layering:

1. Client component memanggil hook.
2. Hook memanggil API route.
3. API route validasi input dengan Zod dan mengambil session.
4. API route memanggil service.
5. Service menjalankan business logic, ownership check, dan query Prisma.
6. Service mengembalikan data yang sudah diserialisasi untuk client.

Route handler dijaga tetap tipis. Query kompleks, agregasi laporan, kalkulasi budget, dan aturan sharing ditempatkan di `lib/services`.

## Model Data

Schema utama ada di `prisma/schema.prisma`.

### User

Menyimpan profil akun, email unik, password hash, currency preference, session/auth relation, dan relasi ke transaksi, budget, kategori, kantong, serta koneksi sharing.

Field penting:

- `id`
- `name`
- `email`
- `password`
- `currency`
- `createdAt`
- `updatedAt`

### Transaction

Menyimpan pemasukan dan pengeluaran.

Field penting:

- `amount` sebagai Decimal `12,2`
- `type` sebagai enum `income` atau `expense`
- `description`
- `date`
- `userId`
- `categoryId`
- `pocketId`

Index penting:

- `[userId]`
- `[userId, date]`
- `[userId, categoryId]`
- `[userId, pocketId]`

### Category

Menyimpan kategori default dan kategori user.

Field penting:

- `name`
- `icon`
- `color`
- `type` sebagai enum `income`, `expense`, atau `both`
- `isDefault`
- `userId`

### Budget

Menyimpan limit pengeluaran per kategori dan periode.

Field penting:

- `limit`
- `spent`
- `period` sebagai enum `weekly`, `monthly`, atau `yearly`
- `startDate`
- `endDate`
- `userId`
- `categoryId`

### Pocket

Menyimpan sumber dana.

Field penting:

- `name`
- `icon`
- `color`
- `initialBalance`
- `userId`

Ada unique constraint `[userId, name]` agar nama kantong tidak dobel untuk user yang sama.

### AccountConnection

Menyimpan koneksi sharing antar akun.

Field penting:

- `status` sebagai enum `pending`, `accepted`, atau `rejected`
- `requesterId`
- `recipientId`
- `acceptedAt`

Ada unique constraint `[requesterId, recipientId]`.

## Setup Lokal

### Prasyarat

- Node.js 20 atau versi kompatibel dengan Next.js 16.
- npm.
- PostgreSQL lokal atau database PostgreSQL hosted.

### Instalasi

```bash
npm install
```

### Siapkan Environment

Salin `.env.example` menjadi `.env`, lalu isi value sesuai database lokal.

```bash
cp .env.example .env
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### Generate Prisma Client

```bash
npm run prisma:generate
```

### Jalankan Migrasi

```bash
npm run prisma:migrate
```

### Seed Kategori Default

```bash
npm run prisma:seed
```

Seed akan membuat atau memperbarui kategori default:

- Gaji
- Bonus
- Makanan
- Transport
- Belanja
- Tagihan
- Kesehatan
- Hiburan
- Investasi
- Lainnya

### Jalankan Development Server

```bash
npm run dev
```

Buka:

```text
http://localhost:3000
```

## Environment Variables

Contoh ada di `.env.example`.

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL untuk runtime app |
| `DIRECT_URL` | Connection string langsung untuk Prisma migrate/seed; fallback ke `DATABASE_URL` jika kosong |
| `AUTH_SECRET` | Secret NextAuth untuk signing token/session |
| `AUTH_URL` | Base URL auth lokal, misalnya `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Base URL public app untuk client-side usage |

Contoh:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/budget_tracking?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/budget_tracking?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Database dan Prisma

Prisma config ada di `prisma.config.ts`.

Schema memakai:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Karena Prisma Client di-generate ke `lib/generated/prisma`, import Prisma di kode menggunakan path generated tersebut, misalnya di seed:

```ts
import { PrismaClient } from "../lib/generated/prisma/client";
```

Untuk akses database runtime, gunakan singleton `lib/prisma.ts`.

Perintah umum:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Jika `prisma/schema.prisma` berubah, jalankan generate dan migrasi yang sesuai.

## Script NPM

| Script | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Next.js development server |
| `npm run build` | Generate Prisma client lalu build Next.js |
| `npm run start` | Menjalankan hasil build |
| `npm run lint` | Menjalankan ESLint |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Membuat dan menjalankan migrasi dev |
| `npm run prisma:seed` | Menjalankan seed database |

`prebuild` otomatis menjalankan `prisma generate` sebelum `next build`.

## Struktur Folder

```text
budget-tracking/
|-- app/
|   |-- (auth)/
|   |   |-- login/
|   |   `-- register/
|   |-- (dashboard)/
|   |   |-- page.tsx
|   |   |-- transactions/
|   |   |-- transaksi/
|   |   |-- pockets/
|   |   |-- kantong/
|   |   |-- categories/
|   |   |-- budgets/
|   |   |-- reports/
|   |   `-- settings/
|   |-- api/
|   |   |-- auth/
|   |   |-- transactions/
|   |   |-- pockets/
|   |   |-- categories/
|   |   |-- budgets/
|   |   |-- reports/
|   |   |-- sharing/
|   |   `-- user/
|   |-- globals.css
|   `-- layout.tsx
|-- components/
|   |-- auth/
|   |-- budgets/
|   |-- categories/
|   |-- common/
|   |-- dashboard/
|   |-- layout/
|   |-- pockets/
|   |-- reports/
|   |-- settings/
|   |-- transactions/
|   `-- ui/
|-- hooks/
|-- lib/
|   |-- actions/
|   |-- generated/
|   |-- services/
|   |-- utils/
|   |-- validations/
|   |-- auth.ts
|   |-- prisma.ts
|   |-- session.ts
|   `-- utils.ts
|-- prisma/
|   |-- migrations/
|   |-- schema.prisma
|   `-- seed.ts
|-- docs/
|-- plan/
|-- types/
|-- proxy.ts
|-- prisma.config.ts
`-- package.json
```

## Aturan Keamanan dan Data

Aturan yang wajib dipertahankan saat mengembangkan fitur:

- Jangan menerima `userId` dari client untuk operasi data finansial.
- Ambil `userId` dari session server-side.
- Semua route data user harus memvalidasi session.
- Semua input body dan query harus divalidasi dengan Zod.
- Password harus di-hash dengan `bcryptjs`.
- Data money memakai Decimal-compatible handling.
- Validasi kategori sebelum dipakai transaksi:
  - kategori harus ada,
  - kategori default boleh dipakai semua user,
  - kategori user harus masuk financial scope,
  - tipe kategori harus cocok dengan tipe transaksi kecuali `both`.
- Validasi kantong sebelum dipakai transaksi.
- Validasi ownership atau financial scope sebelum read/update/delete.
- Jangan expose server-only environment variable ke client.
- Aksi destruktif seperti hapus transaksi dan hapus akun membutuhkan konfirmasi.

## Error, Loading, dan Empty State

UI utama sudah menyediakan:

- Skeleton loading untuk dashboard, transaksi, kantong, kategori, budget, dan laporan.
- Empty state saat data belum tersedia.
- Error state dengan tombol coba lagi.
- Toast success/error/warning melalui Sonner.
- Dialog konfirmasi untuk hapus data penting.

## Validasi dan Service Layer

Schema validasi ada di `lib/validations`:

- `auth.schema.ts`
- `user.schema.ts`
- `transaction.schema.ts`
- `pocket.schema.ts`
- `category.schema.ts`
- `budget.schema.ts`
- `report.schema.ts`
- `sharing.schema.ts`

Service business logic ada di `lib/services`:

- `user.service.ts`
- `transaction.service.ts`
- `pocket.service.ts`
- `category.service.ts`
- `budget.service.ts`
- `report.service.ts`
- `sharing.service.ts`

Saat menambah fitur baru, ikuti pola:

1. Tambah atau ubah model Prisma jika perlu.
2. Tambah Zod schema.
3. Tambah service logic.
4. Tambah API route handler tipis.
5. Tambah hook TanStack Query jika fitur interaktif.
6. Tambah UI.
7. Jalankan lint/build.

## Roadmap

Roadmap lengkap ada di `docs/budget-tracker-phases.md`.

Urutan prioritas MVP:

1. Project setup dan fondasi.
2. Auth dan user management.
3. Transaksi.
4. Dashboard dan visualisasi.
5. Kategori.
6. Budget.
7. Laporan dan export.
8. Settings dan profil.
9. Optimasi, polish, aksesibilitas, dan security hardening.
10. Testing dan deployment.

Peluang pengembangan berikutnya:

- Menentukan apakah sharing jangka panjang tetap memakai account connection atau migrasi ke workspace role-based sharing.
- Menambah test unit untuk validations, utilities, dan services.
- Menambah E2E flow register, login, tambah transaksi, cek dashboard.
- Menambah rate limiting untuk login/register dan API sensitif.
- Menambah audit aksesibilitas untuk halaman dashboard dan form CRUD.
- Menambah CI/CD untuk lint, build, dan test.

## Validasi Sebelum Merge

Jalankan check yang relevan:

```bash
npm run lint
npm run build
```

Jika schema Prisma berubah:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Untuk perubahan yang menyentuh seed:

```bash
npm run prisma:seed
```

## Deployment

Target deployment yang paling natural untuk proyek Next.js ini adalah Vercel dengan PostgreSQL hosted seperti Supabase, Neon, Railway, atau provider PostgreSQL lain.

Checklist deployment:

- Set `DATABASE_URL`.
- Set `DIRECT_URL` jika provider membutuhkan direct connection untuk migrasi.
- Set `AUTH_SECRET` kuat dan unik.
- Set `AUTH_URL` ke domain production.
- Set `NEXT_PUBLIC_APP_URL` ke domain production.
- Jalankan migrasi production.
- Jalankan build.
- Pastikan seed kategori default tersedia di database production.

## Referensi Internal

- Product modules: `docs/budget-tracker-modules.md`
- Development phases: `docs/budget-tracker-phases.md`
- Agent rules: `AGENTS.md`
- Next.js local docs: `node_modules/next/dist/docs/`
