// lib/telegram/resolver.ts
import { prisma } from "@/lib/prisma";

export async function resolveCategory(
  userId: string,
  name: string,
  type: "income" | "expense",
): Promise<string> {
  // 1. User's own categories (case-insensitive match)
  const userCat = await prisma.category.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (userCat) return userCat.id;

  // 2. Default system categories
  const defaultCat = await prisma.category.findFirst({
    where: {
      isDefault: true,
      userId: null,
      name: { equals: name, mode: "insensitive" },
      type: { in: [type, "both"] },
    },
    select: { id: true },
  });
  if (defaultCat) return defaultCat.id;

  // 3. Create new category — catch race condition duplicate
  try {
    const newCat = await prisma.category.create({
      data: { name, type, userId },
      select: { id: true },
    });
    return newCat.id;
  } catch {
    // Another concurrent request created it — find and return the existing one
    const existing = await prisma.category.findFirst({
      where: { userId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return existing.id;
    throw new Error(`Failed to resolve category "${name}" for user ${userId}`);
  }
}

export async function resolvePocket(
  userId: string,
  name: string,
): Promise<string | null> {
  const pocket = await prisma.pocket.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return pocket?.id ?? null;
}
