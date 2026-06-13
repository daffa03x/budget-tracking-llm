-- CreateTable
CREATE TABLE "TelegramProcessedUpdate" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramProcessedUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateIndex
CREATE INDEX "TelegramProcessedUpdate_createdAt_idx" ON "TelegramProcessedUpdate"("createdAt");
