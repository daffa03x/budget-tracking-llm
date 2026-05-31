// app/api/telegram/link/route.ts
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.telegramLink.findFirst({
    where: { userId, linked: true },
    select: { username: true, firstName: true, createdAt: true },
  });

  if (existing) {
    return NextResponse.json({
      already_linked: true,
      telegram_username: existing.username,
      telegram_name: existing.firstName,
      linked_at: existing.createdAt,
    });
  }

  // Remove stale unused tokens for this user
  await prisma.telegramLink.deleteMany({ where: { userId, linked: false } });

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.telegramLink.create({ data: { token, userId, expiresAt } });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json({ error: "TELEGRAM_BOT_USERNAME not configured" }, { status: 500 });
  }
  const deepLink = `https://t.me/${botUsername}?start=${token}`;

  return NextResponse.json({ deep_link: deepLink, expires_in: "15 menit" });
}

export async function GET(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.telegramLink.findFirst({
    where: { userId, linked: true },
    select: { linked: true, username: true, firstName: true, createdAt: true },
  });

  return NextResponse.json({
    linked: !!link,
    telegram_username: link?.username ?? null,
    telegram_name: link?.firstName ?? null,
    linked_at: link?.createdAt ?? null,
  });
}

export async function DELETE(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.telegramLink.deleteMany({ where: { userId } });

  return NextResponse.json({ success: true });
}
