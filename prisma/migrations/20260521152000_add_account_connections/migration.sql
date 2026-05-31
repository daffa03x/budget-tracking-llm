-- CreateEnum
CREATE TYPE "AccountConnectionStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "AccountConnection" (
    "id" TEXT NOT NULL,
    "status" "AccountConnectionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,

    CONSTRAINT "AccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountConnection_requesterId_recipientId_key" ON "AccountConnection"("requesterId", "recipientId");

-- CreateIndex
CREATE INDEX "AccountConnection_requesterId_status_idx" ON "AccountConnection"("requesterId", "status");

-- CreateIndex
CREATE INDEX "AccountConnection_recipientId_status_idx" ON "AccountConnection"("recipientId", "status");

-- AddForeignKey
ALTER TABLE "AccountConnection" ADD CONSTRAINT "AccountConnection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountConnection" ADD CONSTRAINT "AccountConnection_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
