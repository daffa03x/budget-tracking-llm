// lib/telegram/__tests__/resolver.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    pocket: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveCategory, resolvePocket } from "../resolver";

describe("resolveCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing user category id", async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValueOnce({ id: "cat-1" } as never);
    const id = await resolveCategory("user-1", "Makan", "expense");
    expect(id).toBe("cat-1");
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", name: { equals: "Makan", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("falls back to default category when user category not found", async () => {
    vi.mocked(prisma.category.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "default-1" } as never);
    const id = await resolveCategory("user-1", "Makanan", "expense");
    expect(id).toBe("default-1");
  });

  it("creates new category when no match exists", async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.category.create).mockResolvedValue({ id: "new-1" } as never);
    const id = await resolveCategory("user-1", "Hobi", "expense");
    expect(id).toBe("new-1");
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: "Hobi", type: "expense", userId: "user-1" },
      select: { id: true },
    });
  });
});

describe("resolvePocket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pocket id when found", async () => {
    vi.mocked(prisma.pocket.findFirst).mockResolvedValue({ id: "pocket-1" } as never);
    const id = await resolvePocket("user-1", "BCA");
    expect(id).toBe("pocket-1");
  });

  it("returns null when pocket not found", async () => {
    vi.mocked(prisma.pocket.findFirst).mockResolvedValue(null);
    const id = await resolvePocket("user-1", "Nonexistent");
    expect(id).toBeNull();
  });
});
