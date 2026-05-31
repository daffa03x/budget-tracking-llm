import { prisma } from "@/lib/prisma";
import { getFinancialScopeUserIds } from "@/lib/services/sharing.service";
import type { PocketInput, PocketUpdateInput } from "@/lib/validations/pocket.schema";

const pocketSelect = {
  id: true,
  name: true,
  icon: true,
  color: true,
  initialBalance: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PocketRecord = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  initialBalance: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

type PocketSummary = {
  income: number;
  expense: number;
  transactionCount: number;
};

export class PocketNotFoundError extends Error {
  constructor() {
    super("Kantong tidak ditemukan.");
    this.name = "PocketNotFoundError";
  }
}

export class DuplicatePocketNameError extends Error {
  constructor() {
    super("Nama kantong sudah dipakai.");
    this.name = "DuplicatePocketNameError";
  }
}

export class PocketInUseError extends Error {
  constructor() {
    super("Kantong masih dipakai oleh transaksi.");
    this.name = "PocketInUseError";
  }
}

function serializePocket(pocket: PocketRecord, summary?: PocketSummary) {
  const initialBalance = Number(pocket.initialBalance.toString());
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;

  return {
    id: pocket.id,
    name: pocket.name,
    icon: pocket.icon,
    color: pocket.color,
    initialBalance,
    income,
    expense,
    currentBalance: initialBalance + income - expense,
    transactionCount: summary?.transactionCount ?? 0,
    createdAt: pocket.createdAt.toISOString(),
    updatedAt: pocket.updatedAt.toISOString(),
  };
}

async function getPocketSummaries(scopeUserIds: string[], pocketIds: string[]) {
  if (pocketIds.length === 0) {
    return new Map<string, PocketSummary>();
  }

  const rows = await prisma.transaction.groupBy({
    by: ["pocketId", "type"],
    where: {
      userId: {
        in: scopeUserIds,
      },
      pocketId: {
        in: pocketIds,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  const summaries = new Map<string, PocketSummary>();

  rows.forEach((row) => {
    if (!row.pocketId) {
      return;
    }

    const current = summaries.get(row.pocketId) ?? {
      income: 0,
      expense: 0,
      transactionCount: 0,
    };
    const amount = row._sum.amount?.toNumber() ?? 0;

    if (row.type === "income") {
      current.income += amount;
    } else {
      current.expense += amount;
    }

    current.transactionCount += row._count.id;
    summaries.set(row.pocketId, current);
  });

  return summaries;
}

async function assertOwnedPocket(id: string, userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const pocket = await prisma.pocket.findFirst({
    where: {
      id,
      userId: {
        in: scopeUserIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (!pocket) {
    throw new PocketNotFoundError();
  }

  return scopeUserIds;
}

async function assertUniquePocketName(userId: string, name: string, excludeId?: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const existingPocket = await prisma.pocket.findFirst({
    where: {
      userId: {
        in: scopeUserIds,
      },
      name,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: {
      id: true,
    },
  });

  if (existingPocket) {
    throw new DuplicatePocketNameError();
  }
}

export async function getPockets(userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const pockets = await prisma.pocket.findMany({
    where: {
      userId: {
        in: scopeUserIds,
      },
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: pocketSelect,
  });
  const summaries = await getPocketSummaries(
    scopeUserIds,
    pockets.map((pocket) => pocket.id),
  );

  return pockets.map((pocket) => serializePocket(pocket, summaries.get(pocket.id)));
}

export async function createPocket(userId: string, input: PocketInput) {
  await assertUniquePocketName(userId, input.name);

  const pocket = await prisma.pocket.create({
    data: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      initialBalance: input.initialBalance.toFixed(2),
      userId,
    },
    select: pocketSelect,
  });

  return serializePocket(pocket);
}

export async function updatePocket(id: string, userId: string, input: PocketUpdateInput) {
  const scopeUserIds = await assertOwnedPocket(id, userId);

  if (input.name !== undefined) {
    await assertUniquePocketName(userId, input.name, id);
  }

  const pocket = await prisma.pocket.update({
    where: {
      id,
    },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.initialBalance !== undefined
        ? { initialBalance: input.initialBalance.toFixed(2) }
        : {}),
    },
    select: pocketSelect,
  });
  const summaries = await getPocketSummaries(scopeUserIds, [id]);

  return serializePocket(pocket, summaries.get(id));
}

export async function deletePocket(id: string, userId: string) {
  const scopeUserIds = await assertOwnedPocket(id, userId);

  const transactionCount = await prisma.transaction.count({
    where: {
      userId: {
        in: scopeUserIds,
      },
      pocketId: id,
    },
  });

  if (transactionCount > 0) {
    throw new PocketInUseError();
  }

  await prisma.pocket.delete({
    where: {
      id,
    },
  });
}
