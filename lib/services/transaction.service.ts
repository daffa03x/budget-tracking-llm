import { prisma } from "@/lib/prisma";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";
import { getFinancialScopeUserIds } from "@/lib/services/sharing.service";
import type { TransactionWhereInput } from "@/lib/generated/prisma/models/Transaction";
import type { TransactionType } from "@/lib/generated/prisma/client";
import type {
  TransactionFilters,
  TransactionInput,
  TransactionUpdateInput,
} from "@/lib/validations/transaction.schema";

const transactionSelect = {
  id: true,
  amount: true,
  type: true,
  description: true,
  date: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
  pocketId: true,
  category: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      type: true,
      isDefault: true,
    },
  },
  pocket: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  },
} as const;

type CategoryRecord = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: "income" | "expense" | "both";
  isDefault: boolean;
};

type TransactionRecord = {
  id: string;
  amount: { toString(): string };
  type: TransactionType;
  description: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string | null;
  pocketId: string | null;
  category: CategoryRecord | null;
  pocket: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
};

type DateRange = {
  startDate?: Date;
  endDate?: Date;
};

type TransactionFilterInput = Partial<TransactionFilters>;

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaksi tidak ditemukan.");
    this.name = "TransactionNotFoundError";
  }
}

export class TransactionCategoryError extends Error {
  constructor(message = "Kategori tidak valid untuk transaksi ini.") {
    super(message);
    this.name = "TransactionCategoryError";
  }
}

function serializeTransaction(transaction: TransactionRecord) {
  return {
    id: transaction.id,
    amount: Number(transaction.amount.toString()),
    type: transaction.type,
    description: transaction.description,
    date: transaction.date.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    categoryId: transaction.categoryId,
    pocketId: transaction.pocketId,
    category: transaction.category
      ? {
          id: transaction.category.id,
          name: transaction.category.name,
          icon: transaction.category.icon,
          color: transaction.category.color,
          type: transaction.category.type,
          isDefault: transaction.category.isDefault,
        }
      : null,
    pocket: transaction.pocket
      ? {
          id: transaction.pocket.id,
          name: transaction.pocket.name,
          icon: transaction.pocket.icon,
          color: transaction.pocket.color,
        }
      : null,
  };
}

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

function buildTransactionWhere(scopeUserIds: string[], filters: TransactionFilterInput = {}) {
  const andFilters: TransactionWhereInput[] = [
    {
      userId: {
        in: scopeUserIds,
      },
    },
  ];

  if (filters.type) {
    andFilters.push({ type: filters.type });
  }

  if (filters.categoryId) {
    andFilters.push({ categoryId: filters.categoryId });
  }

  if (filters.pocketId) {
    andFilters.push({ pocketId: filters.pocketId });
  }

  if (filters.startDate || filters.endDate) {
    andFilters.push({
      date: {
        ...(filters.startDate ? { gte: startOfDay(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: endOfDay(filters.endDate) } : {}),
      },
    });
  }

  if (filters.search) {
    andFilters.push({
      OR: [
        {
          description: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
        },
        {
          pocket: {
            name: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  return { AND: andFilters };
}

async function ensureUsableCategory(
  userId: string,
  categoryId: string | null | undefined,
  type: TransactionType,
) {
  if (!categoryId) {
    return;
  }

  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [
        {
          isDefault: true,
          userId: null,
        },
        {
          userId: {
            in: scopeUserIds,
          },
        },
      ],
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (!category) {
    throw new TransactionCategoryError("Kategori tidak ditemukan.");
  }

  if (category.type !== "both" && category.type !== type) {
    throw new TransactionCategoryError("Tipe kategori tidak sesuai dengan transaksi.");
  }
}

async function ensureOwnedPocket(userId: string, pocketId: string | null | undefined) {
  if (!pocketId) {
    return;
  }

  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const pocket = await prisma.pocket.findFirst({
    where: {
      id: pocketId,
      userId: {
        in: scopeUserIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (!pocket) {
    throw new TransactionCategoryError("Kantong tidak ditemukan.");
  }
}

async function getOwnedTransaction(id: string, userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      userId: {
        in: scopeUserIds,
      },
    },
    select: transactionSelect,
  });

  if (!transaction) {
    throw new TransactionNotFoundError();
  }

  return transaction;
}

export async function getTransactions(userId: string, filters: TransactionFilterInput = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const where = buildTransactionWhere(scopeUserIds, filters);

  const [transactions, total, summaryRows] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: transactionSelect,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const totalIncome =
    summaryRows.find((row) => row.type === "income")?._sum.amount?.toNumber() ?? 0;
  const totalExpense =
    summaryRows.find((row) => row.type === "expense")?._sum.amount?.toNumber() ?? 0;

  return {
    data: transactions.map(serializeTransaction),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary: {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      transactionCount: total,
    },
  };
}

export async function getTransaction(id: string, userId: string) {
  const transaction = await getOwnedTransaction(id, userId);

  return serializeTransaction(transaction);
}

export async function createTransaction(userId: string, input: TransactionInput) {
  await ensureUsableCategory(userId, input.categoryId, input.type);
  await ensureOwnedPocket(userId, input.pocketId);

  const transaction = await prisma.transaction.create({
    data: {
      amount: input.amount.toFixed(2),
      type: input.type,
      description: input.description ?? null,
      date: input.date,
      categoryId: input.categoryId ?? null,
      pocketId: input.pocketId ?? null,
      userId,
    },
    select: transactionSelect,
  });

  await syncBudgetsForExpenseChange(userId, [
    {
      type: input.type,
      categoryId: input.categoryId,
      date: input.date,
    },
  ]);

  return serializeTransaction(transaction);
}

export async function updateTransaction(
  id: string,
  userId: string,
  input: TransactionUpdateInput,
) {
  const existingTransaction = await getOwnedTransaction(id, userId);
  const nextType = input.type ?? existingTransaction.type;
  const nextCategoryId =
    input.categoryId !== undefined ? input.categoryId : existingTransaction.categoryId;
  const nextPocketId = input.pocketId !== undefined ? input.pocketId : existingTransaction.pocketId;

  await ensureUsableCategory(userId, nextCategoryId, nextType);
  await ensureOwnedPocket(userId, nextPocketId);

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(input.amount !== undefined ? { amount: input.amount.toFixed(2) } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.pocketId !== undefined ? { pocketId: input.pocketId } : {}),
    },
    select: transactionSelect,
  });

  await syncBudgetsForExpenseChange(userId, [
    {
      type: existingTransaction.type,
      categoryId: existingTransaction.categoryId,
      date: existingTransaction.date,
    },
    {
      type: transaction.type,
      categoryId: transaction.categoryId,
      date: transaction.date,
    },
  ]);

  return serializeTransaction(transaction);
}

export async function deleteTransaction(id: string, userId: string) {
  const transaction = await getOwnedTransaction(id, userId);

  await prisma.transaction.delete({
    where: { id },
  });

  await syncBudgetsForExpenseChange(userId, [
    {
      type: transaction.type,
      categoryId: transaction.categoryId,
      date: transaction.date,
    },
  ]);
}

export async function getTransactionSummary(userId: string, dateRange: DateRange = {}) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const where = buildTransactionWhere(scopeUserIds, {
    ...dateRange,
    page: 1,
    limit: 1,
  });

  const summaryRows = await prisma.transaction.groupBy({
    by: ["type"],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  const totalIncome =
    summaryRows.find((row) => row.type === "income")?._sum.amount?.toNumber() ?? 0;
  const totalExpense =
    summaryRows.find((row) => row.type === "expense")?._sum.amount?.toNumber() ?? 0;
  const transactionCount = summaryRows.reduce((total, row) => total + row._count.id, 0);

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    transactionCount,
  };
}
