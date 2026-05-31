import { getBudgets } from "@/lib/services/budget.service";
import { prisma } from "@/lib/prisma";
import { getFinancialScopeUserIds } from "@/lib/services/sharing.service";
import { serializeCsv } from "@/lib/utils/export";
import type { TransactionType } from "@/lib/generated/prisma/client";
import type { TransactionWhereInput } from "@/lib/generated/prisma/models/Transaction";
import type {
  ReportExportQuery,
  ReportMonthlyQuery,
  ReportRangeQuery,
  ReportSummaryQuery,
} from "@/lib/validations/report.schema";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type SummaryRow = {
  type: "income" | "expense";
  _sum: {
    amount: { toNumber(): number } | null;
  };
  _count: {
    id: number;
  };
};

type RecentTransactionRecord = {
  id: string;
  amount: { toString(): string };
  type: "income" | "expense";
  description: string | null;
  date: Date;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
};

type ExportTransactionRecord = {
  amount: { toString(): string };
  type: TransactionType;
  description: string | null;
  date: Date;
  category: {
    name: string;
  } | null;
  pocket: {
    name: string;
  } | null;
};

export type MonthlySummary = {
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
};

export type MonthlyChartPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  netBalance: number;
};

export type MonthlyReportPoint = MonthlyChartPoint & {
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  transactionCount: number;
};

export type CategoryBreakdownPoint = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string;
  amount: number;
  transactionCount: number;
};

export type RecentTransaction = {
  id: string;
  amount: number;
  type: "income" | "expense";
  description: string | null;
  date: string;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
};

export type BudgetOverviewItem = Awaited<ReturnType<typeof getBudgets>>[number];

export type ReportRangePeriod = {
  year: number;
  startMonth: number;
  endMonth: number;
  startDate: string;
  endDate: string;
  label: string;
};

export type ReportRangeSummary = {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
};

export type ReportExportRow = {
  date: string;
  type: TransactionType;
  category: string;
  pocket: string;
  description: string;
  amount: string;
};

type ReportWhereInput = Pick<
  ReportRangeQuery,
  "year" | "startMonth" | "endMonth" | "categoryId" | "pocketId"
> &
  Partial<Pick<ReportExportQuery, "type" | "search" | "startDate" | "endDate">>;

export type DashboardOverview = {
  summary: MonthlySummary;
  monthlyChart: MonthlyChartPoint[];
  categoryBreakdown: CategoryBreakdownPoint[];
  recentTransactions: RecentTransaction[];
  budgetOverview: BudgetOverviewItem[];
};

export type ReportsOverview = {
  period: ReportRangePeriod;
  summary: ReportRangeSummary;
  monthlyReport: MonthlyReportPoint[];
  categoryReport: CategoryBreakdownPoint[];
  trend: MonthlyReportPoint[];
};

function startOfDay(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
}

function startOfMonth(year: number, month: number) {
  return startOfDay(new Date(year, month - 1, 1));
}

function endOfMonth(year: number, month: number) {
  return endOfDay(new Date(year, month, 0));
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${date.getFullYear()}-${month}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function longMonthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function csvDateLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function filenameDateLabel(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getResolvedReportRange(
  input: Pick<ReportRangeQuery, "year" | "startMonth" | "endMonth"> = {},
) {
  const now = new Date();
  const year = input.year ?? now.getFullYear();
  const defaultEndMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const startMonth = input.startMonth ?? 1;
  const endMonth = input.endMonth ?? (input.startMonth ? startMonth : defaultEndMonth);

  return {
    year,
    startMonth,
    endMonth,
    startDate: startOfMonth(year, startMonth),
    endDate: endOfMonth(year, endMonth),
  };
}

function serializeReportRange(
  range: ReturnType<typeof getResolvedReportRange>,
): ReportRangePeriod {
  const startLabel = longMonthLabel(range.startMonth, range.year);
  const endLabel = longMonthLabel(range.endMonth, range.year);

  return {
    year: range.year,
    startMonth: range.startMonth,
    endMonth: range.endMonth,
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
    label: range.startMonth === range.endMonth ? startLabel : `${startLabel} - ${endLabel}`,
  };
}

function buildRangeWhere(
  scopeUserIds: string[],
  input: ReportWhereInput,
) {
  const range = getResolvedReportRange(input);
  const andFilters: TransactionWhereInput[] = [
    {
      userId: {
        in: scopeUserIds,
      },
    },
  ];

  if (input.startDate || input.endDate) {
    andFilters.push({
      date: {
        ...(input.startDate ? { gte: startOfDay(input.startDate) } : {}),
        ...(input.endDate ? { lte: endOfDay(input.endDate) } : {}),
      },
    });
  } else {
    andFilters.push({
      date: {
        gte: range.startDate,
        lte: range.endDate,
      },
    });
  }

  if (input.categoryId) {
    andFilters.push({ categoryId: input.categoryId });
  }

  if (input.pocketId) {
    andFilters.push({ pocketId: input.pocketId });
  }

  if (input.type) {
    andFilters.push({ type: input.type });
  }

  if (input.search) {
    andFilters.push({
      OR: [
        {
          description: {
            contains: input.search,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: input.search,
              mode: "insensitive",
            },
          },
        },
        {
          pocket: {
            name: {
              contains: input.search,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  return {
    range,
    where: {
      AND: andFilters,
    },
  };
}

function createMonthlyBuckets(range: ReturnType<typeof getResolvedReportRange>) {
  const buckets = new Map<string, MonthlyReportPoint>();

  for (let month = range.startMonth; month <= range.endMonth; month += 1) {
    const monthStart = startOfMonth(range.year, month);
    const monthEnd = endOfMonth(range.year, month);
    const key = monthKey(monthStart);

    buckets.set(key, {
      key,
      label: monthLabel(monthStart),
      month,
      year: range.year,
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString(),
      income: 0,
      expense: 0,
      netBalance: 0,
      transactionCount: 0,
    });
  }

  return buckets;
}

function getResolvedPeriod(input: ReportSummaryQuery = {}) {
  const now = new Date();
  const month = input.month ?? now.getMonth() + 1;
  const year = input.year ?? now.getFullYear();

  return {
    month,
    year,
    startDate: startOfMonth(year, month),
    endDate: endOfMonth(year, month),
  };
}

function summarizeRows(rows: SummaryRow[], period: { month: number; year: number } & DateRange) {
  const totalIncome = rows.find((row) => row.type === "income")?._sum.amount?.toNumber() ?? 0;
  const totalExpense = rows.find((row) => row.type === "expense")?._sum.amount?.toNumber() ?? 0;
  const transactionCount = rows.reduce((total, row) => total + row._count.id, 0);

  return {
    month: period.month,
    year: period.year,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    transactionCount,
  };
}

function serializeRecentTransaction(transaction: RecentTransactionRecord): RecentTransaction {
  return {
    id: transaction.id,
    amount: Number(transaction.amount.toString()),
    type: transaction.type,
    description: transaction.description,
    date: transaction.date.toISOString(),
    category: transaction.category
      ? {
          id: transaction.category.id,
          name: transaction.category.name,
          icon: transaction.category.icon,
          color: transaction.category.color,
        }
      : null,
  };
}

export function getReportPeriod(input: ReportSummaryQuery = {}) {
  const period = getResolvedPeriod(input);

  return {
    month: period.month,
    year: period.year,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
  };
}

export function getReportRange(input: ReportRangeQuery | ReportMonthlyQuery = {}) {
  return serializeReportRange(getResolvedReportRange(input));
}

export function buildReportExportFilename(input: ReportExportQuery = {}) {
  if (input.startDate && input.endDate) {
    return `budget-transactions-${filenameDateLabel(input.startDate)}-to-${filenameDateLabel(input.endDate)}.csv`;
  }

  if (input.startDate) {
    return `budget-transactions-from-${filenameDateLabel(input.startDate)}.csv`;
  }

  if (input.endDate) {
    return `budget-transactions-until-${filenameDateLabel(input.endDate)}.csv`;
  }

  const period = getReportRange(input);
  const startMonth = String(period.startMonth).padStart(2, "0");
  const endMonth = String(period.endMonth).padStart(2, "0");

  return `budget-transactions-${period.year}-${startMonth}-${endMonth}.csv`;
}

export async function getReportRangeSummary(
  userId: string,
  input: ReportRangeQuery | ReportMonthlyQuery = {},
): Promise<ReportRangeSummary> {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const { range, where } = buildRangeWhere(scopeUserIds, input);
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });
  const totalIncome = rows.find((row) => row.type === "income")?._sum.amount?.toNumber() ?? 0;
  const totalExpense = rows.find((row) => row.type === "expense")?._sum.amount?.toNumber() ?? 0;
  const transactionCount = rows.reduce((total, row) => total + row._count.id, 0);

  return {
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    transactionCount,
  };
}

export async function getMonthlySummary(
  userId: string,
  input: ReportSummaryQuery = {},
): Promise<MonthlySummary> {
  const period = getResolvedPeriod(input);
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      userId: {
        in: scopeUserIds,
      },
      date: {
        gte: period.startDate,
        lte: period.endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  return summarizeRows(rows, period);
}

export async function getMonthlyChart(userId: string, months = 6): Promise<MonthlyChartPoint[]> {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const safeMonths = Math.min(24, Math.max(1, months));
  const now = new Date();
  const firstMonth = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -(safeMonths - 1));
  const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const buckets = new Map<string, MonthlyChartPoint>();

  for (let index = 0; index < safeMonths; index += 1) {
    const date = addMonths(firstMonth, index);
    const key = monthKey(date);

    buckets.set(key, {
      key,
      label: monthLabel(date),
      income: 0,
      expense: 0,
      netBalance: 0,
    });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: {
        in: scopeUserIds,
      },
      date: {
        gte: firstMonth,
        lte: endOfMonth(lastMonth.getFullYear(), lastMonth.getMonth() + 1),
      },
    },
    select: {
      amount: true,
      type: true,
      date: true,
    },
  });

  transactions.forEach((transaction) => {
    const key = monthKey(transaction.date);
    const bucket = buckets.get(key);

    if (!bucket) {
      return;
    }

    const amount = transaction.amount.toNumber();

    if (transaction.type === "income") {
      bucket.income += amount;
    } else {
      bucket.expense += amount;
    }

    bucket.netBalance = bucket.income - bucket.expense;
  });

  return Array.from(buckets.values());
}

export async function getMonthlyReport(
  userId: string,
  input: ReportRangeQuery | ReportMonthlyQuery = {},
): Promise<MonthlyReportPoint[]> {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const { range, where } = buildRangeWhere(scopeUserIds, input);
  const buckets = createMonthlyBuckets(range);
  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      amount: true,
      type: true,
      date: true,
    },
  });

  transactions.forEach((transaction) => {
    const bucket = buckets.get(monthKey(transaction.date));

    if (!bucket) {
      return;
    }

    const amount = transaction.amount.toNumber();

    if (transaction.type === "income") {
      bucket.income += amount;
    } else {
      bucket.expense += amount;
    }

    bucket.netBalance = bucket.income - bucket.expense;
    bucket.transactionCount += 1;
  });

  return Array.from(buckets.values());
}

export async function getCategoryBreakdown(
  userId: string,
  dateRange: DateRange,
): Promise<CategoryBreakdownPoint[]> {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId: {
        in: scopeUserIds,
      },
      type: "expense",
      date: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });
  const categoryIds = rows
    .map((row) => row.categoryId)
    .filter((categoryId): categoryId is string => Boolean(categoryId));
  const categories = await prisma.category.findMany({
    where: {
      id: {
        in: categoryIds,
      },
    },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return rows
    .map((row) => {
      const category = row.categoryId ? categoryById.get(row.categoryId) : null;

      return {
        categoryId: row.categoryId,
        name: category?.name ?? "Tanpa kategori",
        icon: category?.icon ?? null,
        color: category?.color ?? "#64748B",
        amount: row._sum.amount?.toNumber() ?? 0,
        transactionCount: row._count.id,
      };
    })
    .sort((left, right) => right.amount - left.amount);
}

export async function getCategoryReport(
  userId: string,
  input: ReportRangeQuery | ReportMonthlyQuery = {},
): Promise<CategoryBreakdownPoint[]> {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const { where } = buildRangeWhere(scopeUserIds, input);
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      AND: [
        ...(where.AND ?? []),
        {
          type: "expense",
        },
      ],
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });
  const categoryIds = rows
    .map((row) => row.categoryId)
    .filter((categoryId): categoryId is string => Boolean(categoryId));
  const categories = await prisma.category.findMany({
    where: {
      id: {
        in: categoryIds,
      },
    },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return rows
    .map((row) => {
      const category = row.categoryId ? categoryById.get(row.categoryId) : null;

      return {
        categoryId: row.categoryId,
        name: category?.name ?? "Tanpa kategori",
        icon: category?.icon ?? null,
        color: category?.color ?? "#64748B",
        amount: row._sum.amount?.toNumber() ?? 0,
        transactionCount: row._count.id,
      };
    })
    .sort((left, right) => right.amount - left.amount);
}

export async function getRecentTransactions(userId: string, limit = 5) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: {
        in: scopeUserIds,
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: Math.min(10, Math.max(1, limit)),
    select: {
      id: true,
      amount: true,
      type: true,
      description: true,
      date: true,
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
        },
      },
    },
  });

  return transactions.map(serializeRecentTransaction);
}

export async function getBudgetOverview(userId: string, limit = 5) {
  const budgets = await getBudgets(userId);

  return budgets
    .filter((budget) => budget.timeStatus === "active")
    .sort((left, right) => right.progress - left.progress)
    .slice(0, Math.min(10, Math.max(1, limit)));
}

export async function getReportExportRows(
  userId: string,
  input: ReportExportQuery = {},
): Promise<ReportExportRow[]> {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const { where } = buildRangeWhere(scopeUserIds, input);
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      amount: true,
      type: true,
      description: true,
      date: true,
      category: {
        select: {
          name: true,
        },
      },
      pocket: {
        select: {
          name: true,
        },
      },
    },
  });

  return transactions.map((transaction: ExportTransactionRecord) => ({
    date: csvDateLabel(transaction.date),
    type: transaction.type,
    category: transaction.category?.name ?? "-",
    pocket: transaction.pocket?.name ?? "-",
    description: transaction.description ?? "-",
    amount: transaction.amount.toString(),
  }));
}

export function buildTransactionsCsv(rows: ReportExportRow[]) {
  const typeLabels: Record<TransactionType, string> = {
    income: "Pemasukan",
    expense: "Pengeluaran",
  };

  return serializeCsv(rows, [
    {
      header: "Tanggal",
      value: (row) => row.date,
    },
    {
      header: "Tipe",
      value: (row) => typeLabels[row.type],
    },
    {
      header: "Kategori",
      value: (row) => row.category,
    },
    {
      header: "Kantong",
      value: (row) => row.pocket,
    },
    {
      header: "Deskripsi",
      value: (row) => row.description,
    },
    {
      header: "Jumlah",
      value: (row) => row.amount,
    },
  ]);
}

export async function getReportsOverview(
  userId: string,
  input: ReportRangeQuery = {},
): Promise<ReportsOverview> {
  const [summary, monthlyReport, categoryReport] = await Promise.all([
    getReportRangeSummary(userId, input),
    getMonthlyReport(userId, input),
    getCategoryReport(userId, input),
  ]);

  return {
    period: getReportRange(input),
    summary,
    monthlyReport,
    categoryReport,
    trend: monthlyReport,
  };
}

export async function getDashboardOverview(
  userId: string,
  input: ReportSummaryQuery = {},
): Promise<DashboardOverview> {
  const period = getResolvedPeriod(input);
  const [summary, monthlyChart, categoryBreakdown, recentTransactions, budgetOverview] =
    await Promise.all([
      getMonthlySummary(userId, input),
      getMonthlyChart(userId, 6),
      getCategoryBreakdown(userId, {
        startDate: period.startDate,
        endDate: period.endDate,
      }),
      getRecentTransactions(userId, 5),
      getBudgetOverview(userId, 5),
    ]);

  return {
    summary,
    monthlyChart,
    categoryBreakdown,
    recentTransactions,
    budgetOverview,
  };
}
