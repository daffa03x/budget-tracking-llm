// lib/services/telegram.service.ts
import { prisma } from "@/lib/prisma";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";
import type { Prisma, TelegramInteraction } from "@/lib/generated/prisma/client";

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

const INTERACTION_TTL_MS = 60 * 60 * 1000; // 1 hour

export type DraftItem = {
  type: "income" | "expense";
  amount: number;
  category: string;
  pocketName: string | null;
};

export async function createInteraction(input: {
  chatId: string;
  messageId: number;
  userId: string;
  kind: "draft" | "saved";
  source: "text" | "voice" | "image";
  transactionId?: string | null;
  payload?: DraftItem[] | null;
}): Promise<void> {
  await prisma.telegramInteraction.create({
    data: {
      chatId: input.chatId,
      messageId: input.messageId,
      userId: input.userId,
      kind: input.kind,
      source: input.source,
      transactionId: input.transactionId ?? null,
      payload: (input.payload ?? null) as Prisma.InputJsonValue | undefined,
      expiresAt: new Date(Date.now() + INTERACTION_TTL_MS),
    },
  });
}

// Updates a draft's stored payload after an inline edit (single-item drafts).
export async function updateInteractionPayload(
  chatId: string,
  messageId: number,
  payload: DraftItem[],
): Promise<void> {
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { payload: payload as unknown as Prisma.InputJsonValue },
  });
}

// Resolves a category/pocket id back to its display name so draft payloads
// (which store names, not ids) stay correct after an inline pick.
export async function getCategoryName(userId: string, categoryId: string): Promise<string | null> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null, isDefault: true }] },
    select: { name: true },
  });
  return cat?.name ?? null;
}

export async function getPocketName(userId: string, pocketId: string): Promise<string | null> {
  const pocket = await prisma.pocket.findFirst({
    where: { id: pocketId, userId },
    select: { name: true },
  });
  return pocket?.name ?? null;
}

export async function getInteraction(
  chatId: string,
  messageId: number,
): Promise<TelegramInteraction | null> {
  const row = await prisma.telegramInteraction.findUnique({
    where: { chatId_messageId: { chatId, messageId } },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function setInteractionTransaction(
  chatId: string,
  messageId: number,
  transactionId: string,
): Promise<void> {
  // Keep payload so the category picker can still read the transaction type.
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { kind: "saved", transactionId },
  });
}

export async function setInteractionPendingAmount(
  chatId: string,
  messageId: number,
  promptMessageId: number,
): Promise<void> {
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { pendingField: "amount", promptMessageId },
  });
}

export async function clearInteractionPending(
  chatId: string,
  messageId: number,
): Promise<void> {
  await prisma.telegramInteraction.update({
    where: { chatId_messageId: { chatId, messageId } },
    data: { pendingField: "none", promptMessageId: null },
  });
}

export async function deleteInteraction(chatId: string, messageId: number): Promise<void> {
  await prisma.telegramInteraction
    .delete({ where: { chatId_messageId: { chatId, messageId } } })
    .catch(() => {});
}

// Finds the interaction whose force_reply prompt the user replied to.
export async function findInteractionByPrompt(
  chatId: string,
  promptMessageId: number,
): Promise<TelegramInteraction | null> {
  const row = await prisma.telegramInteraction.findFirst({
    where: { chatId, promptMessageId, pendingField: "amount" },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}
