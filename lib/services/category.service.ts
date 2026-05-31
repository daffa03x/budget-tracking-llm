import { prisma } from "@/lib/prisma";
import { getFinancialScopeUserIds } from "@/lib/services/sharing.service";
import type { CategoryInput, CategoryUpdateInput } from "@/lib/validations/category.schema";

const categorySelect = {
  id: true,
  name: true,
  icon: true,
  color: true,
  type: true,
  isDefault: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CategoryRecord = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: "income" | "expense" | "both";
  isDefault: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Kategori tidak ditemukan.");
    this.name = "CategoryNotFoundError";
  }
}

export class DefaultCategoryMutationError extends Error {
  constructor() {
    super("Kategori default tidak bisa diubah atau dihapus.");
    this.name = "DefaultCategoryMutationError";
  }
}

export class CategoryInUseError extends Error {
  constructor() {
    super("Kategori masih dipakai oleh transaksi atau budget.");
    this.name = "CategoryInUseError";
  }
}

function serializeCategory(category: CategoryRecord) {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    isDefault: category.isDefault,
    canEdit: !category.isDefault,
    canDelete: !category.isDefault,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

async function assertEditableCategory(id: string, userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      isDefault: true,
      userId: true,
    },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  if (category.isDefault) {
    throw new DefaultCategoryMutationError();
  }

  if (!category.userId || !scopeUserIds.includes(category.userId)) {
    throw new CategoryNotFoundError();
  }

  return { category, scopeUserIds };
}

export async function getCategories(userId: string) {
  const scopeUserIds = await getFinancialScopeUserIds(userId);
  const categories = await prisma.category.findMany({
    where: {
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
    orderBy: [{ isDefault: "desc" }, { type: "asc" }, { name: "asc" }],
    select: categorySelect,
  });

  return categories.map(serializeCategory);
}

export async function createCategory(userId: string, input: CategoryInput) {
  const category = await prisma.category.create({
    data: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type,
      userId,
    },
    select: categorySelect,
  });

  return serializeCategory(category);
}

export async function updateCategory(id: string, userId: string, input: CategoryUpdateInput) {
  await assertEditableCategory(id, userId);

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
    },
    select: categorySelect,
  });

  return serializeCategory(category);
}

export async function deleteCategory(id: string, userId: string) {
  const { scopeUserIds } = await assertEditableCategory(id, userId);

  const [transactionCount, budgetCount] = await Promise.all([
    prisma.transaction.count({
      where: {
        categoryId: id,
        userId: {
          in: scopeUserIds,
        },
      },
    }),
    prisma.budget.count({
      where: {
        categoryId: id,
        userId: {
          in: scopeUserIds,
        },
      },
    }),
  ]);

  if (transactionCount > 0 || budgetCount > 0) {
    throw new CategoryInUseError();
  }

  await prisma.category.delete({
    where: { id },
  });
}
