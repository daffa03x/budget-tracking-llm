# Budget Tracker — Development Phases

Stack: **Next.js 16+**, **Prisma**, **shadcn/ui**, **TypeScript**, **PostgreSQL**

---

## Daftar Isi

1. [Phase 1 — Project Setup & Fondasi](#phase-1--project-setup--fondasi)
2. [Phase 2 — Autentikasi & Manajemen User](#phase-2--autentikasi--manajemen-user)
3. [Phase 3 — Modul Kategori](#phase-3--modul-kategori)
4. [Phase 4 — Modul Transaksi](#phase-4--modul-transaksi)
5. [Phase 5 — Modul Budget](#phase-5--modul-budget)
6. [Phase 6 — Dashboard & Visualisasi](#phase-6--dashboard--visualisasi)
7. [Phase 7 — Laporan & Export](#phase-7--laporan--export)
8. [Phase 8 — Settings & Profil](#phase-8--settings--profil)
9. [Phase 9 — Optimasi & Polish](#phase-9--optimasi--polish)
10. [Phase 10 — Testing & Deployment](#phase-10--testing--deployment)
11. [Timeline Estimasi](#timeline-estimasi)

---

## Phase 1 — Project Setup & Fondasi

**Tujuan:** Menyiapkan seluruh infrastruktur project sebelum menulis fitur apapun.

### 1.1 Inisialisasi Project
- [ ] `npx create-next-app@latest` dengan TypeScript, Tailwind CSS, App Router
- [ ] Setup ESLint + Prettier
- [ ] Setup path alias (`@/` → `src/` atau root)
- [ ] Buat file `.env` dan `.env.example`

### 1.2 Install & Konfigurasi Library
- [ ] Install Prisma: `npm install prisma @prisma/client`
- [ ] Install shadcn/ui: `npx shadcn@latest init`
- [ ] Install TanStack Query, Zustand, React Hook Form, Zod
- [ ] Install date-fns, bcryptjs, Recharts, Sonner

### 1.3 Setup Database
- [ ] Buat database PostgreSQL (lokal atau Supabase / Neon / Railway)
- [ ] Konfigurasi `DATABASE_URL` di `.env`
- [ ] `npx prisma init`
- [ ] Tulis schema awal (semua model: User, Transaction, Budget, Category, Account, Session)
- [ ] `npx prisma migrate dev --name init`
- [ ] `npx prisma generate`

### 1.4 Setup Prisma Client Singleton
```ts
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["query"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 1.5 Struktur Folder & Layout Dasar
- [ ] Buat struktur folder: `app/`, `components/`, `lib/`, `hooks/`, `types/`, `prisma/`
- [ ] Buat root layout (`app/layout.tsx`) dengan provider (QueryClient, Toaster)
- [ ] Buat dashboard layout (`app/(dashboard)/layout.tsx`) dengan sidebar & navbar
- [ ] Buat halaman placeholder untuk semua route utama

### 1.6 Seed Data
- [ ] Buat `prisma/seed.ts` dengan kategori default (Makanan, Transport, Gaji, dll.)
- [ ] `npx prisma db seed`

**Output Phase 1:** Project berjalan di localhost, database terhubung, semua halaman kosong tapi dapat diakses.

---

## Phase 2 — Autentikasi & Manajemen User

**Tujuan:** User bisa register, login, dan sesi terjaga antar halaman.

### 2.1 Setup NextAuth.js v5
- [ ] Install: `npm install next-auth@beta`
- [ ] Buat `lib/auth.ts` dengan konfigurasi NextAuth (Credentials provider + Prisma adapter)
- [ ] Buat `app/api/auth/[...nextauth]/route.ts`
- [ ] Tambahkan `AUTH_SECRET` ke `.env`

### 2.2 Halaman Register
- [ ] Form: nama, email, password, konfirmasi password
- [ ] Validasi dengan Zod schema
- [ ] Hash password dengan `bcryptjs`
- [ ] Simpan user baru via Prisma
- [ ] Redirect ke halaman login setelah sukses

### 2.3 Halaman Login
- [ ] Form: email, password
- [ ] Validasi dengan Zod schema
- [ ] Panggil `signIn()` dari NextAuth
- [ ] Tampilkan error jika kredensial salah
- [ ] Redirect ke dashboard setelah berhasil

### 2.4 Middleware Proteksi Route
```ts
// middleware.ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|login|register).*)"],
};
```

### 2.5 Session di Server & Client
- [ ] Helper `getSession()` untuk server components
- [ ] Provider `SessionProvider` untuk client components
- [ ] Tombol logout di navbar

### 2.6 API Route: User Profile
- [ ] `GET /api/user/profile` — ambil data profil user login
- [ ] `PATCH /api/user/profile` — update nama, avatar, currency preference

**Output Phase 2:** Register, login, logout berfungsi. Halaman dashboard tidak bisa diakses tanpa login.

---

## Phase 3 — Modul Kategori

**Tujuan:** User bisa mengelola kategori untuk mengklasifikasikan transaksi.

### 3.1 API Routes Kategori
- [ ] `GET /api/categories` — list semua kategori (default + milik user)
- [ ] `POST /api/categories` — buat kategori baru
- [ ] `PATCH /api/categories/[id]` — update kategori
- [ ] `DELETE /api/categories/[id]` — hapus kategori (cek apakah masih dipakai)

### 3.2 Service Layer
```ts
// lib/services/category.service.ts
export async function getCategories(userId: string) { ... }
export async function createCategory(userId: string, data: CategoryInput) { ... }
export async function updateCategory(id: string, userId: string, data: Partial<CategoryInput>) { ... }
export async function deleteCategory(id: string, userId: string) { ... }
```

### 3.3 Zod Schema
```ts
// lib/validations/category.schema.ts
export const categorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  type: z.enum(["income", "expense", "both"]),
});
```

### 3.4 Halaman & Komponen UI
- [ ] Halaman `/categories` — tabel list kategori
- [ ] Dialog tambah kategori (form + color picker + icon picker)
- [ ] Dialog edit kategori
- [ ] Konfirmasi dialog hapus kategori
- [ ] Komponen `CategoryBadge` — pill dengan warna & ikon

### 3.5 Custom Hook
```ts
// hooks/useCategories.ts
export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}
```

**Output Phase 3:** User bisa melihat, menambah, mengubah, dan menghapus kategori.

---

## Phase 4 — Modul Transaksi

**Tujuan:** Fitur inti — user bisa mencatat semua pemasukan dan pengeluaran.

### 4.1 API Routes Transaksi
- [ ] `GET /api/transactions` — list dengan filter (tanggal, kategori, tipe, search) & pagination
- [ ] `POST /api/transactions` — buat transaksi baru
- [ ] `GET /api/transactions/[id]` — detail transaksi
- [ ] `PATCH /api/transactions/[id]` — update transaksi
- [ ] `DELETE /api/transactions/[id]` — hapus transaksi

### 4.2 Service Layer
```ts
// lib/services/transaction.service.ts
export async function getTransactions(userId: string, filters: TransactionFilters) { ... }
export async function createTransaction(userId: string, data: TransactionInput) { ... }
export async function updateTransaction(id: string, userId: string, data: Partial<TransactionInput>) { ... }
export async function deleteTransaction(id: string, userId: string) { ... }
export async function getTransactionSummary(userId: string, dateRange: DateRange) { ... }
```

### 4.3 Zod Schema
```ts
// lib/validations/transaction.schema.ts
export const transactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  description: z.string().max(255).optional(),
  date: z.coerce.date(),
  categoryId: z.string().cuid().optional(),
});
```

### 4.4 Halaman & Komponen UI
- [ ] Halaman `/transactions` — tabel dengan filter bar di atas
- [ ] Filter bar: date range picker, dropdown kategori, toggle income/expense, search
- [ ] Pagination component
- [ ] Sheet/Dialog tambah transaksi
- [ ] Sheet/Dialog edit transaksi
- [ ] Konfirmasi hapus transaksi
- [ ] Komponen `TransactionItem` — satu baris transaksi dengan ikon kategori
- [ ] Komponen `CurrencyInput` — input angka otomatis format Rupiah

### 4.5 Custom Hook
```ts
// hooks/useTransactions.ts
export function useTransactions(filters: TransactionFilters) {
  return useQuery({ queryKey: ["transactions", filters], queryFn: () => fetchTransactions(filters) });
}

export function useCreateTransaction() {
  return useMutation({ mutationFn: createTransaction, onSuccess: () => queryClient.invalidateQueries(["transactions"]) });
}
```

### 4.6 Utility Functions
```ts
// lib/utils.ts
export function formatCurrency(amount: number, currency = "IDR"): string { ... }
export function groupTransactionsByDate(transactions: Transaction[]): Record<string, Transaction[]> { ... }
```

**Output Phase 4:** User bisa mencatat, melihat, mengfilter, mengubah, dan menghapus transaksi.

---

## Phase 5 — Modul Budget

**Tujuan:** User bisa menetapkan batas anggaran per kategori dan memantau penggunaannya.

### 5.1 API Routes Budget
- [ ] `GET /api/budgets` — list budget aktif user
- [ ] `POST /api/budgets` — buat budget baru
- [ ] `GET /api/budgets/[id]` — detail budget + progress
- [ ] `PATCH /api/budgets/[id]` — update budget
- [ ] `DELETE /api/budgets/[id]` — hapus budget

### 5.2 Service Layer
```ts
// lib/services/budget.service.ts
export async function getBudgets(userId: string) { ... }
export async function createBudget(userId: string, data: BudgetInput) { ... }
export async function updateBudgetSpent(budgetId: string, amount: number) { ... }
export async function checkBudgetAlert(userId: string, categoryId: string) { ... }
export async function calculateBudgetProgress(budgetId: string): Promise<BudgetProgress> { ... }
```

### 5.3 Zod Schema
```ts
// lib/validations/budget.schema.ts
export const budgetSchema = z.object({
  limit: z.number().positive(),
  period: z.enum(["weekly", "monthly", "yearly"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  categoryId: z.string().cuid(),
});
```

### 5.4 Logika Otomatis
- [ ] Saat transaksi expense dibuat/diupdate, update field `spent` di budget terkait
- [ ] Alert toast jika `spent >= 80%` dari `limit`
- [ ] Alert toast jika `spent >= 100%` dari `limit` (overspend)

### 5.5 Halaman & Komponen UI
- [ ] Halaman `/budgets` — grid kartu budget
- [ ] Komponen `BudgetCard` — menampilkan nama kategori, limit, spent, progress bar, persentase
- [ ] Progress bar berwarna: hijau (< 70%), kuning (70-90%), merah (> 90%)
- [ ] Dialog tambah budget
- [ ] Dialog edit budget
- [ ] Konfirmasi hapus budget

### 5.6 Custom Hook
```ts
// hooks/useBudgets.ts
export function useBudgets() {
  return useQuery({ queryKey: ["budgets"], queryFn: fetchBudgets });
}
```

**Output Phase 5:** User bisa membuat budget per kategori dan melihat seberapa banyak sudah terpakai secara real-time.

---

## Phase 6 — Dashboard & Visualisasi

**Tujuan:** Halaman utama yang memberikan gambaran lengkap kondisi keuangan user.

### 6.1 API Route Summary
- [ ] `GET /api/reports/summary` — total income, total expense, saldo bersih bulan ini
- [ ] `GET /api/reports/monthly` — data agregasi per bulan untuk chart

### 6.2 Service Layer
```ts
// lib/services/report.service.ts
export async function getMonthlySummary(userId: string, month: number, year: number) { ... }
export async function getMonthlyChart(userId: string, months: number) { ... }
export async function getCategoryBreakdown(userId: string, dateRange: DateRange) { ... }
```

### 6.3 Komponen Dashboard
- [ ] `StatCard` — 4 kartu: Total Pemasukan, Total Pengeluaran, Saldo Bersih, Jumlah Transaksi
- [ ] `MonthlyBarChart` — bar chart income vs expense per bulan (Recharts)
- [ ] `CategoryPieChart` — pie chart pengeluaran per kategori
- [ ] `RecentTransactions` — 5 transaksi terbaru dengan link ke halaman transaksi
- [ ] `BudgetOverview` — mini progress bar semua budget aktif
- [ ] `MonthSelector` — dropdown atau arrow untuk ganti bulan yang ditampilkan

### 6.4 Implementasi Chart (Recharts)
```tsx
// Contoh MonthlyBarChart
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function MonthlyBarChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Bar dataKey="income" fill="#22c55e" />
        <Bar dataKey="expense" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 6.5 Server Components vs Client Components
- Data fetching awal → Server Component (lebih cepat, SEO-friendly)
- Chart & interaktivitas → Client Component dengan `"use client"`
- Gunakan `Suspense` + skeleton loading untuk UX yang baik

**Output Phase 6:** Dashboard menampilkan ringkasan keuangan lengkap dengan chart yang interaktif.

---

## Phase 7 — Laporan & Export

**Tujuan:** User bisa menganalisis keuangan secara mendalam dan mengunduh data.

### 7.1 API Routes Report
- [ ] `GET /api/reports/monthly` — data per bulan dalam rentang waktu tertentu
- [ ] `GET /api/reports/category` — breakdown per kategori dalam periode
- [ ] `GET /api/reports/export` — export data transaksi ke CSV

### 7.2 Halaman `/reports`
- [ ] Filter: pilih tahun, pilih rentang bulan
- [ ] Tab: Bulanan | Per Kategori | Tren
- [ ] `YearlyLineChart` — tren pengeluaran sepanjang tahun
- [ ] `CategoryBarChart` — perbandingan pengeluaran per kategori
- [ ] Tabel ringkasan bulanan (income, expense, net per bulan)

### 7.3 Fitur Export CSV
```ts
// lib/utils/export.ts
import Papa from "papaparse";

export function exportToCSV(transactions: Transaction[], filename: string) {
  const csv = Papa.unparse(transactions.map(t => ({
    Tanggal: format(t.date, "dd/MM/yyyy"),
    Tipe: t.type,
    Kategori: t.category?.name ?? "-",
    Deskripsi: t.description ?? "-",
    Jumlah: t.amount.toString(),
  })));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
}
```

- [ ] Tombol "Export CSV" di halaman reports & transactions
- [ ] Pilihan filter sebelum export (rentang tanggal, kategori)

**Output Phase 7:** User bisa melihat laporan mendalam dan mengunduh data transaksi sebagai file CSV.

---

## Phase 8 — Settings & Profil

**Tujuan:** User bisa mengatur preferensi, informasi akun, dan sharing budget tracking dengan member lain.

### 8.1 Halaman `/settings`
Tab atau section:

**Profil**
- [ ] Update nama tampilan
- [ ] Upload foto profil (opsional, simpan URL)
- [ ] Ganti email (dengan konfirmasi)

**Preferensi**
- [ ] Pilih mata uang default (IDR, USD, EUR, dll.)
- [ ] Pilih format tanggal (DD/MM/YYYY atau MM/DD/YYYY)
- [ ] Pilih hari awal minggu

**Keamanan**
- [ ] Ganti password (old password, new password, konfirmasi)
- [ ] Tampilkan sesi aktif (opsional)

**Danger Zone**
- [ ] Hapus semua data transaksi (dengan konfirmasi)
- [ ] Hapus akun (dengan konfirmasi + input password)

### 8.2 Sharing & Member
- [ ] Buat personal workspace default untuk setiap user
- [ ] User bisa membuat workspace/shared budget book tambahan
- [ ] Owner/admin bisa mengundang member lewat email
- [ ] Member menerima undangan melalui token sekali pakai dengan expiry
- [ ] Role member: owner, admin, editor, viewer
- [ ] Viewer hanya bisa melihat dashboard, transaksi, budget, kategori, dan laporan
- [ ] Editor bisa menambah/mengubah/menghapus transaksi, kategori, dan budget di workspace
- [ ] Admin bisa mengelola member selain owner
- [ ] Owner bisa transfer ownership, menghapus workspace, atau menghapus member
- [ ] User bisa memilih active workspace di dashboard shell
- [ ] Dashboard, transaksi, budget, kategori, dan laporan hanya menampilkan data workspace aktif

### 8.3 API Routes Settings & Sharing
- [ ] `GET /api/workspaces` - list workspace yang bisa diakses user login
- [ ] `POST /api/workspaces` - buat workspace/shared budget book
- [ ] `GET /api/workspaces/[id]/members` - list member workspace
- [ ] `POST /api/workspaces/[id]/members` - undang member by email
- [ ] `PATCH /api/workspaces/[id]/members/[memberId]` - update role member
- [ ] `DELETE /api/workspaces/[id]/members/[memberId]` - hapus member dari workspace
- [ ] `POST /api/invitations/[token]/accept` - terima undangan workspace
- [ ] `PATCH /api/user/profile` — update profil & preferensi
- [ ] `PATCH /api/user/password` — ganti password
- [ ] `DELETE /api/user` — hapus akun beserta semua data

**Output Phase 8:** User bisa mengatur akun, preferensi aplikasi, dan berbagi budget tracking dengan member lain sesuai role.

---

## Phase 9 — Optimasi & Polish

**Tujuan:** Meningkatkan performa, UX, dan ketangguhan aplikasi.

### 9.1 Loading & Error States
- [ ] Skeleton loading untuk semua komponen yang fetch data
- [ ] Empty state yang informatif ("Belum ada transaksi, yuk mulai catat!")
- [ ] Error boundary untuk komponen yang bisa gagal
- [ ] Toast notifikasi untuk semua aksi (sukses & gagal)

### 9.2 Optimasi Performa
- [ ] Gunakan `React.memo` untuk komponen list yang sering re-render
- [ ] Pagination atau infinite scroll untuk tabel transaksi
- [ ] Index database Prisma pada kolom yang sering di-query (`userId`, `date`, `categoryId`)
- [ ] Gunakan `select` Prisma untuk hanya mengambil field yang dibutuhkan

```prisma
// Tambahkan index di schema.prisma
model Transaction {
  ...
  @@index([userId])
  @@index([userId, date])
  @@index([userId, categoryId])
}
```

### 9.3 Keamanan
- [ ] Validasi membership workspace dan role untuk semua data yang dishare
- [ ] Jangan percaya `workspaceId` dari client sebelum dicek terhadap session user
- [ ] Invitation token harus random, sekali pakai, dan punya expiry
- [ ] Rate limiting pada API routes sensitif (login, register)
- [ ] Validasi ownership — pastikan user hanya bisa akses data miliknya
- [ ] Sanitasi semua input sebelum disimpan ke database
- [ ] Environment variables tidak ter-expose ke client

### 9.4 Aksesibilitas & Responsif
- [ ] Semua komponen shadcn/ui sudah accessible secara default
- [ ] Pastikan layout responsif di mobile (sidebar collapse, tabel scroll horizontal)
- [ ] Test di ukuran layar 375px, 768px, 1280px

### 9.5 Dark Mode
- [ ] Aktifkan `darkMode: "class"` di Tailwind config
- [ ] Toggle dark/light mode di navbar atau settings
- [ ] Simpan preferensi di localStorage atau user settings

**Output Phase 9:** Aplikasi terasa cepat, responsif, aman, dan menyenangkan digunakan.

---

## Phase 10 — Testing & Deployment

**Tujuan:** Memastikan aplikasi bebas bug dan siap diakses publik.

### 10.1 Testing
- [ ] Install Vitest + Testing Library: `npm install -D vitest @testing-library/react`
- [ ] Unit test untuk utility functions (`formatCurrency`, `calculateBudgetProgress`, dll.)
- [ ] Unit test untuk Zod validation schemas
- [ ] Integration test untuk service layer (dengan Prisma mock)
- [ ] E2E test kritis dengan Playwright: register → login → tambah transaksi → cek dashboard

### 10.2 Persiapan Deployment
- [ ] Audit semua environment variables, pastikan `.env.production` lengkap
- [ ] Jalankan `npx prisma migrate deploy` untuk production database
- [ ] Build check: `npm run build` harus 0 error
- [ ] Setup logging (misalnya Sentry untuk error tracking)

### 10.3 Deployment ke Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

- [ ] Tambahkan environment variables di Vercel dashboard
- [ ] Hubungkan dengan database production (Supabase / Neon / Railway)
- [ ] Konfigurasi domain custom (opsional)

### 10.4 CI/CD (Opsional)
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

**Output Phase 10:** Aplikasi live, stabil, dan otomatis ter-deploy setiap push ke main branch.

---

## Timeline Estimasi

| Phase | Nama | Estimasi |
|---|---|---|
| Phase 1 | Project Setup & Fondasi | 1–2 hari |
| Phase 2 | Autentikasi & User | 2–3 hari |
| Phase 3 | Modul Kategori | 1–2 hari |
| Phase 4 | Modul Transaksi | 3–4 hari |
| Phase 5 | Modul Budget | 2–3 hari |
| Phase 6 | Dashboard & Visualisasi | 2–3 hari |
| Phase 7 | Laporan & Export | 2–3 hari |
| Phase 8 | Settings & Profil | 1–2 hari |
| Phase 9 | Optimasi & Polish | 2–3 hari |
| Phase 10 | Testing & Deployment | 2–3 hari |
| **Total** | | **~18–28 hari** |

> Estimasi untuk 1 developer. Bisa dipercepat dengan pair programming atau tim.

---

## Urutan Prioritas (MVP)

Jika ingin rilis cepat, fokus ke phase berikut terlebih dahulu:

1. ✅ Phase 1 — Setup
2. ✅ Phase 2 — Auth
3. ✅ Phase 4 — Transaksi *(fitur inti)*
4. ✅ Phase 6 — Dashboard *(nilai utama bagi user)*
5. ✅ Phase 3 — Kategori *(pendukung transaksi)*
6. ⏳ Phase 5, 7, 8, 9, 10 — Iterasi berikutnya
