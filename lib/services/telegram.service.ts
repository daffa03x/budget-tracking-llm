// lib/services/telegram.service.ts
import { prisma } from "@/lib/prisma";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";

type BotTransactionInput = {
  type: "income" | "expense";
  amount: number;
  categoryId: string;
  pocketId?: string | null;
  description?: string | null;
  source: "text" | "voice" | "image";
  rawInput?: string | null;
  telegramChatId: string;
  userId: string;
  date?: Date;
};

export async function createTransactionFromBot(input: BotTransactionInput) {
  const date = input.date ?? new Date();

  const transaction = await prisma.transaction.create({
    data: {
      amount: input.amount.toFixed(2),
      type: input.type,
      description: input.description ?? null,
      date,
      categoryId: input.categoryId,
      pocketId: input.pocketId ?? null,
      source: input.source,
      rawInput: input.rawInput ?? null,
      telegramChatId: input.telegramChatId,
      userId: input.userId,
    },
    select: {
      id: true,
      amount: true,
      type: true,
      category: { select: { name: true } },
    },
  });

  await syncBudgetsForExpenseChange(input.userId, [
    { type: input.type, categoryId: input.categoryId, date },
  ]);

  return transaction;
}

// Claims a Telegram update_id for processing. Returns true if this is the first
// time we've seen it (process it), false if it was already handled (a webhook
// retry — skip to avoid duplicate transactions). Fails open: on unexpected DB
// errors we still process, preferring a rare duplicate over a dropped message.
export async function claimTelegramUpdate(updateId: number): Promise<boolean> {
  try {
    await prisma.telegramProcessedUpdate.create({ data: { updateId: BigInt(updateId) } });
    return true;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return false; // unique violation → already processed
    }
    console.error("[Bot] claimTelegramUpdate failed, processing anyway:", err);
    return true;
  }
}

export async function getLinkedUserId(chatId: string): Promise<string | null> {
  const link = await prisma.telegramLink.findFirst({
    where: { chatId, linked: true },
    select: { userId: true },
  });
  return link?.userId ?? null;
}

type OwnedTxn = {
  id: string;
  type: "income" | "expense";
  categoryId: string | null;
  date: Date;
};

async function findOwnedTransaction(userId: string, transactionId: string): Promise<OwnedTxn | null> {
  return prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, type: true, categoryId: true, date: true },
  });
}

async function resyncExpense(userId: string, txn: OwnedTxn): Promise<void> {
  if (txn.type === "expense") {
    await syncBudgetsForExpenseChange(userId, [
      { type: txn.type, categoryId: txn.categoryId, date: txn.date },
    ]);
  }
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.update({ where: { id: transactionId }, data: { categoryId } });
  await resyncExpense(userId, txn); // old category
  await resyncExpense(userId, { ...txn, categoryId }); // new category
  return true;
}

export async function updateTransactionPocket(
  userId: string,
  transactionId: string,
  pocketId: string,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.update({ where: { id: transactionId }, data: { pocketId } });
  return true;
}

export async function updateTransactionAmount(
  userId: string,
  transactionId: string,
  amount: number,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { amount: amount.toFixed(2) },
  });
  await resyncExpense(userId, txn);
  return true;
}

export async function deleteTransactionById(
  userId: string,
  transactionId: string,
): Promise<boolean> {
  const txn = await findOwnedTransaction(userId, transactionId);
  if (!txn) return false;
  await prisma.transaction.delete({ where: { id: transactionId } });
  await resyncExpense(userId, txn);
  return true;
}

export async function listCategoriesForUser(
  userId: string,
  type: "income" | "expense",
): Promise<{ id: string; name: string }[]> {
  return prisma.category.findMany({
    where: {
      OR: [
        { userId, type: { in: [type, "both"] } },
        { userId: null, isDefault: true, type: { in: [type, "both"] } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export async function listPocketsForUser(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return prisma.pocket.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}
