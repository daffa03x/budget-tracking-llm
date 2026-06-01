// lib/telegram/__tests__/report.pocket.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pocket: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getPocketBalances } from "../report";

const mockFindMany = vi.mocked(prisma.pocket.findMany);

describe("getPocketBalances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns guidance message when user has no pockets", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await getPocketBalances("user-1");
    expect(result).toBe("Belum ada pocket. Buat pocket di website terlebih dahulu.");
  });

  it("returns all pockets when no filter given", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "1000000", transactions: [] },
      { name: "Gopay", initialBalance: "200000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1");
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
    expect(result).toContain("Rp1.000.000");
    expect(result).toContain("Rp200.000");
  });

  it("calculates balance as initialBalance + income - expense", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        name: "BCA",
        initialBalance: "1000000",
        transactions: [
          { type: "income", amount: "500000" },
          { type: "expense", amount: "200000" },
        ],
      },
    ] as never);
    const result = await getPocketBalances("user-1");
    // 1000000 + 500000 - 200000 = 1300000
    expect(result).toContain("Rp1.300.000");
  });

  it("returns single pocket when filter matches exactly one", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
      { name: "Gopay", initialBalance: "100000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "BCA");
    expect(result).toContain("BCA");
    expect(result).not.toContain("Gopay");
    expect(result).toContain("Saldo:");
  });

  it("filter is case-insensitive", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "bca");
    expect(result).toContain("BCA");
  });

  it("filter matches substring", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA Tabungan", initialBalance: "500000", transactions: [] },
      { name: "Gopay", initialBalance: "100000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "bca");
    expect(result).toContain("BCA Tabungan");
    expect(result).not.toContain("Gopay");
  });

  it("returns list when filter matches multiple pockets", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
      { name: "BCA Dollar", initialBalance: "100000", transactions: [] },
      { name: "Gopay", initialBalance: "200000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "BCA");
    expect(result).toContain("BCA");
    expect(result).toContain("BCA Dollar");
    expect(result).not.toContain("Gopay");
  });

  it("falls back to all pockets with not-found message when filter has no match", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "BCA", initialBalance: "500000", transactions: [] },
      { name: "Gopay", initialBalance: "100000", transactions: [] },
    ] as never);
    const result = await getPocketBalances("user-1", "Dana");
    expect(result).toContain("Dana");
    expect(result).toContain("tidak ditemukan");
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
  });
});
