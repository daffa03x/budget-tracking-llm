-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('web', 'text', 'voice', 'image');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "rawInput" TEXT,
ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'web',
ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "username" TEXT,
    "firstName" TEXT,
    "linked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_token_key" ON "TelegramLink"("token");

-- CreateIndex
CREATE INDEX "TelegramLink_userId_idx" ON "TelegramLink"("userId");

-- CreateIndex
CREATE INDEX "TelegramLink_token_idx" ON "TelegramLink"("token");

-- CreateIndex
CREATE INDEX "TelegramLink_chatId_idx" ON "TelegramLink"("chatId");

-- CreateIndex
CREATE INDEX "Transaction_telegramChatId_idx" ON "Transaction"("telegramChatId");

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
