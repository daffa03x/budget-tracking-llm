// lib/services/__tests__/telegram.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { findMany: vi.fn() },
    pocket: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/budget.service", () => ({
  syncBudgetsForExpenseChange: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";
import {
  updateTransactionAmount,
  deleteTransactionById,
  listCategoriesForUser,
} from "../telegram.service";

describe("updateTransactionAmount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the transaction is not owned by the user", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
    const ok = await updateTransactionAmount("user-1", "txn-1", 75000);
    expect(ok).toBe(false);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it("updates amount and re-syncs budgets for an owned expense", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
      id: "txn-1",
      type: "expense",
      categoryId: "cat-1",
      date: new Date("2026-06-13"),
    } as never);
    const ok = await updateTransactionAmount("user-1", "txn-1", 75000);
    expect(ok).toBe(true);
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { amount: "75000.00" },
    });
    expect(syncBudgetsForExpenseChange).toHaveBeenCalledWith("user-1", [
      { type: "expense", categoryId: "cat-1", date: new Date("2026-06-13") },
    ]);
  });
});

describe("deleteTransactionById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false for an unowned transaction", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
    expect(await deleteTransactionById("user-1", "txn-x")).toBe(false);
    expect(prisma.transaction.delete).not.toHaveBeenCalled();
  });

  it("deletes an owned transaction", async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
      id: "txn-1",
      type: "income",
      categoryId: "cat-1",
      date: new Date("2026-06-13"),
    } as never);
    expect(await deleteTransactionById("user-1", "txn-1")).toBe(true);
    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: "txn-1" } });
  });
});

describe("listCategoriesForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user categories for a type", async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValueOnce([
      { id: "c1", name: "Makan" },
    ] as never);
    const cats = await listCategoriesForUser("user-1", "expense");
    expect(cats).toEqual([{ id: "c1", name: "Makan" }]);
  });
});
