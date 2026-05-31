# Budget Tracker — Arsitektur Modul (Next.js Fullstack)

Stack utama: **Next.js (App Router)**, **Prisma**, **shadcn/ui**, **TypeScript**

---

## Daftar Isi

1. [Frontend — Halaman & UI](#1-frontend--halaman--ui)
2. [API Layer — Route Handlers](#2-api-layer--route-handlers)
3. [Service / Business Logic](#3-service--business-logic)
4. [Data Layer — Prisma Schema](#4-data-layer--prisma-schema)
5. [Shared — Components, Hooks, Utils](#5-shared--components-hooks-utils)
6. [Library Stack Lengkap](#6-library-stack-lengkap)
7. [Struktur Folder](#7-struktur-folder)

---

## 1. Frontend — Halaman & UI

Lokasi: `/app`

| Modul | Route | Deskripsi |
|---|---|---|
| Dashboard | `/` | Ringkasan saldo, chart pengeluaran, budget overview |
| Transactions | `/transactions` | CRUD pemasukan & pengeluaran, filter, pagination |
| Budgets | `/budgets` | Atur batas anggaran per kategori & periode |
| Reports | `/reports` | Analitik bulanan/tahunan, export CSV/PDF |
| Categories | `/categories` | Kelola kategori kustom (nama, ikon, warna) |
| Settings / Profile | `/settings` | User preferences, update akun |
| Members / Sharing | `/settings/members` | Undang anggota dan kelola akses sharing budget tracking |
| Auth Pages | `/login`, `/register` | Login, register, forgot password |

**Komponen UI yang digunakan (shadcn/ui):**
- `Table`, `DataTable` — daftar transaksi
- `Dialog`, `Sheet` — form tambah/edit transaksi
- `Form` + `React Hook Form` — validasi input
- `Select`, `DatePicker`, `Input` — filter & form fields
- `Card` — ringkasan statistik
- `Chart` (Recharts) — bar chart, pie chart, line chart
- `Badge` — label kategori & status budget
- `Toast` / `Sonner` — notifikasi aksi

---

## 2. API Layer — Route Handlers

Lokasi: `/app/api`

| Route | Method | Deskripsi |
|---|---|---|
| `/api/auth/[...nextauth]` | — | NextAuth.js handler (login, session, callback) |
| `/api/transactions` | GET, POST | List transaksi (filter, pagination) & buat baru |
| `/api/transactions/[id]` | GET, PATCH, DELETE | Detail, update, hapus transaksi |
| `/api/budgets` | GET, POST | List & buat budget |
| `/api/budgets/[id]` | GET, PATCH, DELETE | Detail, update, hapus budget |
| `/api/categories` | GET, POST | List & buat kategori |
| `/api/categories/[id]` | PATCH, DELETE | Update & hapus kategori |
| `/api/reports/summary` | GET | Ringkasan saldo & statistik |
| `/api/reports/monthly` | GET | Data agregasi per bulan |
| `/api/user/profile` | GET, PATCH | Profil user login |
| `/api/workspaces` | GET, POST | List workspace dan buat workspace/shared budget book |
| `/api/workspaces/[id]/members` | GET, POST | List anggota dan undang member ke workspace |
| `/api/workspaces/[id]/members/[memberId]` | PATCH, DELETE | Update role atau hapus member |
| `/api/invitations/[token]/accept` | POST | Terima undangan sharing budget tracking |

Semua route dilindungi oleh **middleware auth** (`middleware.ts`) menggunakan NextAuth session. Route data finansial juga wajib memvalidasi membership workspace dan role, bukan hanya `userId`.

---

## 3. Service / Business Logic

Lokasi: `/lib/services`

### `TransactionService`
- Filter transaksi berdasarkan tanggal, kategori, tipe (income/expense)
- Pagination dengan cursor-based atau offset
- Kalkulasi total pemasukan, pengeluaran, dan saldo bersih

### `BudgetService`
- Cek apakah pengeluaran melebihi limit budget
- Kalkulasi persentase penggunaan budget per kategori
- Trigger alert/notifikasi jika mendekati atau melewati limit

### `ReportService`
- Agregasi data transaksi per bulan dan per tahun
- Grouping berdasarkan kategori
- Generate data untuk chart (bar, pie, line)
- Export data ke CSV

### `AuthService` / `UserService`
- Hashing password menggunakan `bcryptjs`
- Validasi session dan permission
- Update profil & preferensi user

### `WorkspaceService` / `SharingService`
- Membuat personal workspace default saat user register
- Mengelola workspace/shared budget book untuk keluarga, pasangan, atau tim kecil
- Invite member melalui email dengan token sekali pakai dan expiry
- Role member: `owner`, `admin`, `editor`, `viewer`
- Enforce permission: viewer hanya baca, editor bisa CRUD transaksi/budget/kategori, admin bisa kelola member, owner bisa transfer ownership atau hapus workspace
- Semua query transaksi, budget, kategori, report, dan dashboard difilter berdasarkan `workspaceId` yang user punya aksesnya

---

## 4. Data Layer — Prisma Schema

Lokasi: `prisma/schema.prisma`

### Model `User`
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  currency      String    @default("IDR")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  transactions  Transaction[]
  budgets       Budget[]
  categories    Category[]
  ownedWorkspaces Workspace[]
  memberships   WorkspaceMember[]
  sentInvitations WorkspaceInvitation[]
}
```

### Model `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`
```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ownerId String
  owner   User @relation(fields: [ownerId], references: [id])

  members      WorkspaceMember[]
  invitations  WorkspaceInvitation[]
  transactions Transaction[]
  budgets      Budget[]
  categories   Category[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  role        String   // "owner" | "admin" | "editor" | "viewer"
  joinedAt    DateTime @default(now())

  userId      String
  workspaceId String

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
}

model WorkspaceInvitation {
  id          String   @id @default(cuid())
  email       String
  role        String
  token       String   @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime @default(now())

  workspaceId String
  invitedById String

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy User      @relation(fields: [invitedById], references: [id])
}
```

Untuk fitur sharing, `Transaction`, `Budget`, `Category`, dan model finansial lain harus memiliki `workspaceId`. Field `userId` tetap boleh dipakai sebagai pembuat record, tetapi boundary akses utama adalah membership workspace.

### Model `Transaction`
```prisma
model Transaction {
  id          String   @id @default(cuid())
  amount      Decimal
  type        String   // "income" | "expense"
  description String?
  date        DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId      String
  workspaceId String
  user        User     @relation(fields: [userId], references: [id])
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
}
```

### Model `Budget`
```prisma
model Budget {
  id         String   @id @default(cuid())
  limit      Decimal
  spent      Decimal  @default(0)
  period     String   // "monthly" | "weekly" | "yearly"
  startDate  DateTime
  endDate    DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  userId     String
  workspaceId String
  user       User     @relation(fields: [userId], references: [id])
  workspace  Workspace @relation(fields: [workspaceId], references: [id])
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
}
```

### Model `Category`
```prisma
model Category {
  id           String        @id @default(cuid())
  name         String
  icon         String?
  color        String?
  type         String        // "income" | "expense" | "both"
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())

  userId       String?
  workspaceId  String?
  user         User?         @relation(fields: [userId], references: [id])
  workspace    Workspace?    @relation(fields: [workspaceId], references: [id])
  transactions Transaction[]
  budgets      Budget[]
}
```

### Model `Account` & `Session` (NextAuth Adapter)
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 5. Shared — Components, Hooks, Utils

### `/components/ui`
Komponen shadcn/ui yang di-install dan dikustomisasi.

### `/components/common`
| Komponen | Deskripsi |
|---|---|
| `TransactionForm` | Form tambah/edit transaksi dengan validasi Zod |
| `BudgetCard` | Kartu budget dengan progress bar |
| `CategoryBadge` | Badge kategori dengan ikon & warna |
| `CurrencyInput` | Input field format mata uang (Rupiah) |
| `DateRangePicker` | Picker rentang tanggal untuk filter |
| `StatCard` | Kartu statistik ringkasan |
| `ChartWrapper` | Wrapper Recharts dengan responsive container |
| `MemberInviteDialog` | Dialog undang member dan pilih role |
| `MemberRoleBadge` | Badge role owner/admin/editor/viewer |

### `/hooks`
| Hook | Deskripsi |
|---|---|
| `useTransactions` | Fetch & mutasi data transaksi (TanStack Query) |
| `useBudgets` | Fetch & mutasi data budget |
| `useCategories` | Fetch daftar kategori |
| `useReports` | Fetch data laporan & chart |
| `useCurrency` | Format angka ke mata uang (IDR default) |
| `useWorkspaceMembers` | Fetch anggota workspace dan mutasi invite/update role/remove |

### `/lib/validations`
Zod schemas untuk validasi form dan API input:
- `transactionSchema`
- `budgetSchema`
- `categorySchema`
- `userProfileSchema`

### `/lib/utils`
| Fungsi | Deskripsi |
|---|---|
| `formatCurrency(amount, currency)` | Format angka ke Rupiah / mata uang lain |
| `formatDate(date, format)` | Format tanggal menggunakan date-fns |
| `getDateRange(period)` | Hitung rentang tanggal berdasarkan periode |
| `calculateBudgetProgress(spent, limit)` | Hitung persentase penggunaan budget |
| `groupTransactionsByDate(transactions)` | Grouping transaksi untuk chart |

---

## 6. Library Stack Lengkap

| Kebutuhan | Library | Versi |
|---|---|---|
| Framework | Next.js | 16+ (App Router) |
| Language | TypeScript | 5+ |
| ORM | Prisma | 5+ |
| Database | PostgreSQL (prod) / SQLite (dev) | — |
| Auth | NextAuth.js | v5 (beta) |
| UI Components | shadcn/ui + Tailwind CSS | latest |
| Charts | Recharts | 2+ |
| Form | React Hook Form | 7+ |
| Validation | Zod | 3+ |
| Data Fetching | TanStack Query (React Query) | 5+ |
| State Management | Zustand | 4+ |
| Date Utility | date-fns | 3+ |
| Password Hashing | bcryptjs | — |
| Notifications | Sonner | — |
| Export | xlsx / papaparse | — |

---

## 7. Struktur Folder

```
budget-tracker/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Dashboard
│   │   ├── transactions/page.tsx
│   │   ├── budgets/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── categories/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── transactions/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── budgets/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── categories/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── reports/
│       │   ├── summary/route.ts
│       │   └── monthly/route.ts
│       └── user/
│           └── profile/route.ts
├── components/
│   ├── ui/                           # shadcn/ui components
│   └── common/                       # Custom reusable components
├── hooks/                            # Custom React hooks
├── lib/
│   ├── services/                     # Business logic
│   │   ├── transaction.service.ts
│   │   ├── budget.service.ts
│   │   ├── report.service.ts
│   │   └── auth.service.ts
│   ├── validations/                  # Zod schemas
│   ├── utils.ts                      # Utility functions
│   ├── auth.ts                       # NextAuth config
│   └── prisma.ts                     # Prisma client singleton
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── types/                            # TypeScript type definitions
├── middleware.ts                     # Auth middleware
└── .env
```

---

> Klik modul di diagram untuk melihat detail implementasi, atau tanyakan modul spesifik yang ingin dikerjakan lebih dulu.
