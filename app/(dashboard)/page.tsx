import { Suspense } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { MonthlyBarChart } from "@/components/dashboard/monthly-bar-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  type DashboardOverview,
  getDashboardOverview,
  getReportPeriod,
} from "@/lib/services/report.service";
import { getSession, requireUserId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { reportSummaryQuerySchema } from "@/lib/validations/report.schema";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getDashboardQuery(searchParams?: DashboardPageProps["searchParams"]) {
  const params = searchParams
    ? await searchParams
    : ({} as Record<string, string | string[] | undefined>);
  const parsedQuery = reportSummaryQuerySchema.safeParse({
    month: getFirstParam(params.month),
    year: getFirstParam(params.year),
  });

  return parsedQuery.success ? parsedQuery.data : {};
}

function getPeriodLabel(period: ReturnType<typeof getReportPeriod>) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(period.year, period.month - 1, 1));
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

async function DashboardContent({
  overviewPromise,
  currency,
}: {
  overviewPromise: Promise<DashboardOverview>;
  currency: string;
}) {
  const overview = await overviewPromise;
  const periodLabel = getPeriodLabel(overview.summary);

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pemasukan bulan ini"
          value={formatCurrency(overview.summary.totalIncome, currency)}
          helper={periodLabel}
          icon={ArrowUpCircle}
          tone="text-emerald-600"
        />
        <StatCard
          label="Pengeluaran bulan ini"
          value={formatCurrency(overview.summary.totalExpense, currency)}
          helper={periodLabel}
          icon={ArrowDownCircle}
          tone="text-rose-600"
        />
        <StatCard
          label="Saldo bersih"
          value={formatCurrency(overview.summary.netBalance, currency)}
          helper={overview.summary.netBalance >= 0 ? "Surplus" : "Defisit"}
          icon={WalletCards}
          tone="text-blue-600"
        />
        <StatCard
          label="Transaksi"
          value={String(overview.summary.transactionCount)}
          helper="Dalam periode terpilih"
          icon={ReceiptText}
          tone="text-violet-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border bg-card p-5 text-card-foreground">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Grafik Bulanan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pemasukan dan pengeluaran 6 bulan terakhir.
              </p>
            </div>
            <BarChart3 className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="mt-6">
            <MonthlyBarChart data={overview.monthlyChart} currency={currency} />
          </div>
        </section>

        <RecentTransactions transactions={overview.recentTransactions} currency={currency} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-lg border bg-card p-5 text-card-foreground">
          <div>
            <h2 className="text-base font-semibold">Pengeluaran per Kategori</h2>
            <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
          </div>
          <div className="mt-6">
            <CategoryPieChart data={overview.categoryBreakdown} currency={currency} />
          </div>
        </section>

        <BudgetOverview budgets={overview.budgetOverview} currency={currency} />
      </div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const query = await getDashboardQuery(searchParams);
  const userId = await requireUserId();
  const session = await getSession();
  const currency = session?.user?.currency ?? "IDR";
  const overviewPromise = getDashboardOverview(userId, query);
  const period = getReportPeriod(query);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Ringkasan Keuangan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Snapshot pemasukan, pengeluaran, budget, dan aktivitas terbaru.
          </p>
        </div>
        <MonthSelector month={period.month} year={period.year} />
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent overviewPromise={overviewPromise} currency={currency} />
      </Suspense>
    </section>
  );
}
