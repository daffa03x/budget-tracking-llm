import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CalendarRange,
  ReceiptText,
  Table2,
  Tags,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { MonthlyBarChart } from "@/components/dashboard/monthly-bar-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { CategoryBarChart } from "@/components/reports/category-bar-chart";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { YearlyLineChart } from "@/components/reports/yearly-line-chart";
import { getCategories } from "@/lib/services/category.service";
import {
  type MonthlyReportPoint,
  type ReportsOverview,
  getReportRange,
  getReportsOverview,
} from "@/lib/services/report.service";
import { getSession, requireUserId } from "@/lib/session";
import { cn, formatCurrency } from "@/lib/utils";
import {
  type ReportRangeQuery,
  reportRangeQuerySchema,
} from "@/lib/validations/report.schema";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ReportTab = "monthly" | "category" | "trend";
type CategoryOption = Awaited<ReturnType<typeof getCategories>>[number];

const tabs: { value: ReportTab; label: string; icon: LucideIcon }[] = [
  { value: "monthly", label: "Bulanan", icon: Table2 },
  { value: "category", label: "Per Kategori", icon: Tags },
  { value: "trend", label: "Tren", icon: TrendingUp },
];

const monthOptions = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
].map((label, index) => ({ label, value: index + 1 }));

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getReportsQuery(
  searchParams?: ReportsPageProps["searchParams"],
): Promise<ReportRangeQuery> {
  const params = searchParams
    ? await searchParams
    : ({} as Record<string, string | string[] | undefined>);
  const parsedQuery = reportRangeQuerySchema.safeParse({
    year: getFirstParam(params.year),
    startMonth: getFirstParam(params.startMonth),
    endMonth: getFirstParam(params.endMonth),
    categoryId: getFirstParam(params.categoryId),
    tab: getFirstParam(params.tab),
  });

  return parsedQuery.success ? parsedQuery.data : {};
}

function buildReportsHref(query: ReportRangeQuery, overrides: Partial<ReportRangeQuery> = {}) {
  const nextQuery = {
    ...query,
    ...overrides,
  };
  const searchParams = new URLSearchParams();

  if (nextQuery.year) {
    searchParams.set("year", String(nextQuery.year));
  }

  if (nextQuery.startMonth) {
    searchParams.set("startMonth", String(nextQuery.startMonth));
  }

  if (nextQuery.endMonth) {
    searchParams.set("endMonth", String(nextQuery.endMonth));
  }

  if (nextQuery.categoryId) {
    searchParams.set("categoryId", nextQuery.categoryId);
  }

  if (nextQuery.tab) {
    searchParams.set("tab", nextQuery.tab);
  }

  const queryString = searchParams.toString();

  return queryString ? `/reports?${queryString}` : "/reports";
}

function buildExportHref(query: ReportRangeQuery) {
  const searchParams = new URLSearchParams();

  if (query.year) {
    searchParams.set("year", String(query.year));
  }

  if (query.startMonth) {
    searchParams.set("startMonth", String(query.startMonth));
  }

  if (query.endMonth) {
    searchParams.set("endMonth", String(query.endMonth));
  }

  if (query.categoryId) {
    searchParams.set("categoryId", query.categoryId);
  }

  const queryString = searchParams.toString();

  return queryString ? `/api/reports/export?${queryString}` : "/api/reports/export";
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function MonthlySummaryTable({
  rows,
  currency,
}: {
  rows: MonthlyReportPoint[];
  currency: string;
}) {
  return (
    <section className="rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-4 border-b p-5">
        <div>
          <h2 className="text-base font-semibold">Ringkasan Bulanan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Income, expense, dan saldo bersih.</p>
        </div>
        <Table2 className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Bulan</th>
              <th className="px-4 py-3 text-right font-semibold">Pemasukan</th>
              <th className="px-4 py-3 text-right font-semibold">Pengeluaran</th>
              <th className="px-4 py-3 text-right font-semibold">Saldo Bersih</th>
              <th className="px-4 py-3 text-right font-semibold">Transaksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.key} className="transition-colors hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{row.label}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-700">
                  {formatCurrency(row.income, currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-rose-700">
                  {formatCurrency(row.expense, currency)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-right font-semibold",
                    row.netBalance >= 0 ? "text-blue-700" : "text-rose-700",
                  )}
                >
                  {formatCurrency(row.netBalance, currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                  {row.transactionCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportsTabPanel({
  overview,
  activeTab,
  currency,
}: {
  overview: ReportsOverview;
  activeTab: ReportTab;
  currency: string;
}) {
  if (activeTab === "category") {
    return (
      <section className="rounded-lg border bg-card p-5 text-card-foreground">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Pengeluaran per Kategori</h2>
            <p className="mt-1 text-sm text-muted-foreground">{overview.period.label}</p>
          </div>
          <Tags className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-6">
          <CategoryBarChart data={overview.categoryReport} currency={currency} />
        </div>
      </section>
    );
  }

  if (activeTab === "trend") {
    return (
      <section className="rounded-lg border bg-card p-5 text-card-foreground">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Tren Tahunan</h2>
            <p className="mt-1 text-sm text-muted-foreground">{overview.period.label}</p>
          </div>
          <TrendingUp className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-6">
          <YearlyLineChart data={overview.trend} currency={currency} />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Bulanan</h2>
          <p className="mt-1 text-sm text-muted-foreground">{overview.period.label}</p>
        </div>
        <BarChart3 className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-6">
        <MonthlyBarChart data={overview.monthlyReport} currency={currency} />
      </div>
    </section>
  );
}

async function ReportsContent({
  overviewPromise,
  activeTab,
  currency,
}: {
  overviewPromise: Promise<ReportsOverview>;
  activeTab: ReportTab;
  currency: string;
}) {
  const overview = await overviewPromise;

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total pemasukan"
          value={formatCurrency(overview.summary.totalIncome, currency)}
          helper={overview.period.label}
          icon={ArrowUpCircle}
          tone="text-emerald-600"
        />
        <StatCard
          label="Total pengeluaran"
          value={formatCurrency(overview.summary.totalExpense, currency)}
          helper={overview.period.label}
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
          helper="Dalam filter aktif"
          icon={ReceiptText}
          tone="text-violet-600"
        />
      </div>

      <ReportsTabPanel overview={overview} activeTab={activeTab} currency={currency} />
      <MonthlySummaryTable rows={overview.monthlyReport} currency={currency} />
    </section>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const query = await getReportsQuery(searchParams);
  const activeTab = query.tab ?? "monthly";
  const userId = await requireUserId();
  const session = await getSession();
  const currency = session?.user?.currency ?? "IDR";
  const categories = await getCategories(userId);
  const period = getReportRange(query);
  const overviewPromise = getReportsOverview(userId, query);
  const exportHref = buildExportHref(query);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Laporan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Analitik bulanan, kategori, tren, dan export transaksi.
            </p>
          </div>
        </div>
        <ReportExportButton href={exportHref} className="w-full sm:w-auto" />
      </div>

      <form
        action="/reports"
        method="get"
        className="grid gap-3 rounded-lg border bg-card p-4 text-card-foreground lg:grid-cols-[minmax(120px,0.8fr)_repeat(3,minmax(150px,1fr))_auto]"
      >
        <input type="hidden" name="tab" value={activeTab} />
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Tahun</span>
          <input
            type="number"
            name="year"
            min={2000}
            max={2100}
            defaultValue={period.year}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Dari</span>
          <select
            name="startMonth"
            defaultValue={period.startMonth}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Sampai</span>
          <select
            name="endMonth"
            defaultValue={period.endMonth}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Kategori</span>
          <select
            name="categoryId"
            defaultValue={query.categoryId ?? ""}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">Semua kategori</option>
            {categories.map((category: CategoryOption) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:flex-none"
          >
            <CalendarRange className="size-4" aria-hidden="true" />
            Terapkan
          </button>
          <Link
            href="/reports"
            className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="flex gap-2 overflow-x-auto rounded-lg border bg-card p-1 text-card-foreground">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <Link
              key={tab.value}
              href={buildReportsHref(query, { tab: tab.value })}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsContent
          overviewPromise={overviewPromise}
          activeTab={activeTab}
          currency={currency}
        />
      </Suspense>
    </section>
  );
}
