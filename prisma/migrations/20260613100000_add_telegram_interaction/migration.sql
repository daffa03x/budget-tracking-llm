-- CreateEnum
CREATE TYPE "TelegramInteractionKind" AS ENUM ('draft', 'saved');

-- CreateEnum
CREATE TYPE "TelegramPendingField" AS ENUM ('none', 'amount');

-- CreateTable
CREATE TABLE "TelegramInteraction" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TelegramInteractionKind" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'text',
    "transactionId" TEXT,
    "payload" JSONB,
    "pendingField" "TelegramPendingField" NOT NULL DEFAULT 'none',
    "promptMessageId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramInteraction_chatId_messageId_key" ON "TelegramInteraction"("chatId", "messageId");

-- CreateIndex
CREATE INDEX "TelegramInteraction_expiresAt_idx" ON "TelegramInteraction"("expiresAt");
