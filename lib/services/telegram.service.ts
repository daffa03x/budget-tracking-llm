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

export async function getLinkedUserId(chatId: string): Promise<string | null> {
  const link = await prisma.telegramLink.findFirst({
    where: { chatId, linked: true },
    select: { userId: true },
  });
  return link?.userId ?? null;
}
