import { prisma } from "@/lib/prisma";
import { getFinancialScopeUserIds } from "@/lib/services/sharing.service";
import { calculateBudgetProgress } from "@/lib/utils";
import type { TransactionType, BudgetPeriod } from "@/lib/generated/prisma/client";
import type { BudgetInput, BudgetUpdateInput } from "@/lib/validations/budget.schema";

const budgetSelect = {
  id: true,
  limit: true,
  spent: true,
  period: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  categoryId: true,
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
} as const;

type BudgetRecord = {
  id: string;
  limit: { toString(): string };
  spent: { toString(): string };
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: "income" | "expense" | "both";
    isDefault: boolean;
  };
};

type ExpenseBudgetChange = {
  type?: TransactionType | null;
  categoryId?: string | null;
  date?: Date | string | null;
};

export class BudgetNotFoundError extends Error {
  constructor() {
    super("Budget tidak ditemukan.");
    this.name = "BudgetNotFoundError";
  }
}

export class BudgetCategoryError extends Error {
  constructor(message = "Kategori tidak valid untuk budget.") {
    super(message);
    this.name = "BudgetCategoryError";
  }
}

export class BudgetDateOverlapError extends Error {
  constructor() {
    super("Budget untuk kategori dan rentang tanggal ini sudah ada.");
    this.name = "BudgetDateOverlapError";
  }
}

export class BudgetDateRangeError extends Error {
  constructor() {
    super("Tanggal akhir harus setelah tanggal mulai.");
    this.name = "BudgetDateRangeError";
  }
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

function getUsageStatus(progress: number) {
  if (progress >= 100) {
    return "exceeded";
  }

  if (progress >= 80) {
    return "warning";
  }

  return "safe";
}

function getTimeStatus(startDate: Date, endDate: Date) {
  const now = new Date();

  if (now < startDate) {
    return "upcoming";
  }

  if (now > endDate) {
    return "expired";
  }

  return "active";
}

function serializeBudget(budget: BudgetRecord, currentSpent: number) {
  const limit = Number(budget.limit.toString());
  const progress = calculateBudgetProgress(currentSpent, limit);
  const remaining = Math.max(0, limit - currentSpent);

  return {
    id: budget.id,
    limit,
    spent: currentSpent,
    remaining,
    progress,
    usageStatus: getUsageStatus(progress),
    timeStatus: getTimeStatus(budget.startDate, budget.endDate),
    period: budget.period,
    startDate: budget.startDate.toISOString(),
    endDate: budget.endDate.toISOString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    categoryId: budget.categoryId,
    category: {
      id: budget.category.id,
      name: budget.category.name,
      icon: budget.category.icon,
      color: budget.category.color,
      type: budget.category.type,
      isDefault: budget.category.isDefault,
    },
  };
}

async function calculateSpent(
  scopeUserIds: string[],
  categoryId: string,
  startDate: Date,
  endDate: Date,
) {
  const aggregate = await prisma.transaction.aggregate({
    where: {
      userId: {
        in: scopeUserIds,
      },
      categoryId,
      type: "expense",
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    },
    _sum: {
      amount: true,
    },
  });

  return aggregate._sum.amount?.toNumber() ?? 0;
}

async function serializeWithCurrentSpent(budget: BudgetRecord, scopeUserIds: string[]) {
  const currentSpent = await calculateSpent(
    scopeUserIds,
    budget.categoryId,
    budget.startDate,
    budget.endDate,
  );
  const cachedSpent = Number(budget.spent.toString());

  if (Math.round(cachedSpent * 100) !== Math.round(currentSpent * 100)) {
    await prisma.budget.update({
      where: {
        id: budget.id,
      },
      data: {
        spent: currentSpent.toFixed(2),
      },
    });
  }

  return serializeBudget(budget, currentSpent);
}

async function ensureBudgetCategory(userId: string, categoryId: string) {
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
    throw new BudgetCategoryError("Kategori tidak ditemukan.");
  }

  if (category.type === "income") {
    throw new BudgetCategoryError("Budget hanya bisa memakai kategori pengeluaran.");
  }
}

async function ensureNoOverlappingBudget(
  userId: string,
  categoryId: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string,
) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const existingBudget = await prisma.budget.findFirst({
    where: {
      userId: {
        in: scopeUserIds,
      },
      categoryId,
      startDate: {
        lte: endOfDay(endDate),
      },
      endDate: {
        gte: startOfDay(startDate),
      },
      ...(excludeId
        ? {
            NOT: {
              id: excludeId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existingBudget) {
    throw new BudgetDateOverlapError();
  }
}

async function getOwnedBudget(id: string, userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const budget = await prisma.budget.findFirst({
    where: {
      id,
      userId: {
        in: scopeUserIds,
      },
    },
    select: budgetSelect,
  });

  if (!budget) {
    throw new BudgetNotFoundError();
  }

  return { budget, scopeUserIds };
}

async function refreshBudgetSpent(
  budget: Pick<BudgetRecord, "id" | "categoryId" | "startDate" | "endDate">,
  scopeUserIds: string[],
) {
  const currentSpent = await calculateSpent(
    scopeUserIds,
    budget.categoryId,
    budget.startDate,
    budget.endDate,
  );

  await prisma.budget.update({
    where: {
      id: budget.id,
    },
    data: {
      spent: currentSpent.toFixed(2),
    },
  });
}

export async function getBudgets(userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const budgets = await prisma.budget.findMany({
    where: {
      userId: {
        in: scopeUserIds,
      },
    },
    orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
    select: budgetSelect,
  });

  return Promise.all(budgets.map((budget) => serializeWithCurrentSpent(budget, scopeUserIds)));
}

export async function getBudget(id: string, userId: string) {
  const { budget, scopeUserIds } = await getOwnedBudget(id, userId);

  return serializeWithCurrentSpent(budget, scopeUserIds);
}

export async function createBudget(userId: string, input: BudgetInput) {
  const startDate = startOfDay(input.startDate);
  const endDate = endOfDay(input.endDate);

  if (startDate > endDate) {
    throw new BudgetDateRangeError();
  }

  await ensureBudgetCategory(userId, input.categoryId);
  await ensureNoOverlappingBudget(userId, input.categoryId, startDate, endDate);

  const budget = await prisma.budget.create({
    data: {
      limit: input.limit.toFixed(2),
      spent: "0.00",
      period: input.period,
      startDate,
      endDate,
      categoryId: input.categoryId,
      userId,
    },
    select: budgetSelect,
  });

  const scopeUserIds = await getFinancialScopeUserIds(userId);

  return serializeWithCurrentSpent(budget, scopeUserIds);
}

export async function updateBudget(id: string, userId: string, input: BudgetUpdateInput) {
  const { budget: existingBudget, scopeUserIds } = await getOwnedBudget(id, userId);
  const nextCategoryId = input.categoryId ?? existingBudget.categoryId;
  const nextStartDate = input.startDate ? startOfDay(input.startDate) : existingBudget.startDate;
  const nextEndDate = input.endDate ? endOfDay(input.endDate) : existingBudget.endDate;

  if (nextStartDate > nextEndDate) {
    throw new BudgetDateRangeError();
  }

  await ensureBudgetCategory(userId, nextCategoryId);
  await ensureNoOverlappingBudget(userId, nextCategoryId, nextStartDate, nextEndDate, id);

  const budget = await prisma.budget.update({
    where: {
      id,
    },
    data: {
      ...(input.limit !== undefined ? { limit: input.limit.toFixed(2) } : {}),
      ...(input.period !== undefined ? { period: input.period } : {}),
      ...(input.startDate !== undefined ? { startDate: nextStartDate } : {}),
      ...(input.endDate !== undefined ? { endDate: nextEndDate } : {}),
      ...(input.categoryId !== undefined ? { categoryId: nextCategoryId } : {}),
    },
    select: budgetSelect,
  });

  return serializeWithCurrentSpent(budget, scopeUserIds);
}

export async function deleteBudget(id: string, userId: string) {
  await getOwnedBudget(id, userId);

  await prisma.budget.delete({
    where: {
      id,
    },
  });
}

export async function syncBudgetsForExpenseChange(userId: string, changes: ExpenseBudgetChange[]) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const targets = new Map<string, { categoryId: string; date: Date }>();

  changes.forEach((change) => {
    if (change.type !== "expense" || !change.categoryId || !change.date) {
      return;
    }

    const date = change.date instanceof Date ? change.date : new Date(change.date);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    targets.set(`${change.categoryId}:${date.toISOString()}`, {
      categoryId: change.categoryId,
      date,
    });
  });

  if (targets.size === 0) {
    return;
  }

  await Promise.all(
    Array.from(targets.values()).map(async ({ categoryId, date }) => {
      const budgets = await prisma.budget.findMany({
        where: {
          userId: {
            in: scopeUserIds,
          },
          categoryId,
          startDate: {
            lte: date,
          },
          endDate: {
            gte: date,
          },
        },
        select: {
          id: true,
          categoryId: true,
          startDate: true,
          endDate: true,
        },
      });

      await Promise.all(budgets.map((budget) => refreshBudgetSpent(budget, scopeUserIds)));
    }),
  );
}
