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
    telegramInteraction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
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
  createInteraction,
  getInteraction,
  findInteractionByPrompt,
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

describe("createInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a draft interaction with payload + expiry", async () => {
    vi.mocked(prisma.telegramInteraction.create).mockResolvedValueOnce({ id: "i1" } as never);
    await createInteraction({
      chatId: "123",
      messageId: 55,
      userId: "user-1",
      kind: "draft",
      source: "image",
      payload: [{ type: "expense", amount: 50000, category: "Makan", pocketName: null }],
    });
    const arg = vi.mocked(prisma.telegramInteraction.create).mock.calls[0][0] as {
      data: { chatId: string; messageId: number; kind: string; expiresAt: Date };
    };
    expect(arg.data.chatId).toBe("123");
    expect(arg.data.messageId).toBe(55);
    expect(arg.data.kind).toBe("draft");
    expect(arg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("getInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for an expired interaction", async () => {
    vi.mocked(prisma.telegramInteraction.findUnique).mockResolvedValueOnce({
      id: "i1",
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    expect(await getInteraction("123", 55)).toBeNull();
  });

  it("returns a live interaction", async () => {
    const live = { id: "i1", expiresAt: new Date(Date.now() + 60000), kind: "draft" };
    vi.mocked(prisma.telegramInteraction.findUnique).mockResolvedValueOnce(live as never);
    expect(await getInteraction("123", 55)).toEqual(live);
  });
});

describe("findInteractionByPrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no matching prompt exists", async () => {
    vi.mocked(prisma.telegramInteraction.findFirst).mockResolvedValueOnce(null);
    expect(await findInteractionByPrompt("123", 99)).toBeNull();
  });

  it("returns null for an expired interaction", async () => {
    vi.mocked(prisma.telegramInteraction.findFirst).mockResolvedValueOnce({
      id: "i1",
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    expect(await findInteractionByPrompt("123", 99)).toBeNull();
  });

  it("returns a live interaction matching the prompt", async () => {
    const live = { id: "i1", expiresAt: new Date(Date.now() + 60000), pendingField: "amount" };
    vi.mocked(prisma.telegramInteraction.findFirst).mockResolvedValueOnce(live as never);
    expect(await findInteractionByPrompt("123", 99)).toEqual(live);
  });
});
