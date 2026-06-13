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
