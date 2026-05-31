-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "pocketId" TEXT;

-- CreateTable
CREATE TABLE "Pocket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "initialBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Pocket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_userId_pocketId_idx" ON "Transaction"("userId", "pocketId");

-- CreateIndex
CREATE INDEX "Transaction_pocketId_idx" ON "Transaction"("pocketId");

-- CreateIndex
CREATE UNIQUE INDEX "Pocket_userId_name_key" ON "Pocket"("userId", "name");

-- CreateIndex
CREATE INDEX "Pocket_userId_idx" ON "Pocket"("userId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "Pocket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pocket" ADD CONSTRAINT "Pocket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
