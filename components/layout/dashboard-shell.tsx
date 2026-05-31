import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Settings,
  Tags,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { signOut } from "@/lib/auth";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type DashboardShellProps = {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    currency?: string | null;
  };
};

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/pockets", label: "Kantong", icon: WalletCards },
  { href: "/categories", label: "Kategori", icon: Tags },
  { href: "/budgets", label: "Budget", icon: Target },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children, user }: DashboardShellProps) {
  const displayName = user.name ?? user.email ?? "User";
  const currency = user.currency ?? "IDR";

  return (
    <div className="min-h-dvh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="flex h-16 items-center gap-3 border-b px-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <WalletCards className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5">Budget Tracking</span>
              <span className="block text-xs text-muted-foreground">Personal finance</span>
            </span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4">
            <div className="rounded-lg border bg-card p-3 text-sm text-card-foreground">
              <div className="flex items-center gap-2 font-medium">
                <CircleDollarSign className="size-4 text-emerald-600" aria-hidden="true" />
                {currency}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Preferensi mata uang akun aktif.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <WalletCards className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">Budget Tracking</span>
            </Link>
            <div className="hidden lg:block">
              <p className="text-sm font-medium">Dashboard</p>
              <p className="text-xs text-muted-foreground">Sesi aktif untuk {displayName}</p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <form
                action={async () => {
                  "use server";

                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-card-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Keluar
                </button>
              </form>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
