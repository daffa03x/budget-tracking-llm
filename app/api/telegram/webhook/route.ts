// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handleUpdate } from "@/lib/telegram/handler";
import { claimTelegramUpdate } from "@/lib/services/telegram.service";
import type { TelegramUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");

  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;

  // Skip updates we've already handled — Telegram resends an update if it
  // doesn't get a fast 200, which would otherwise double-record slow
  // voice/image transactions.
  if (typeof update.update_id === "number") {
    const fresh = await claimTelegramUpdate(update.update_id);
    if (!fresh) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("[Telegram webhook] unhandled error:", err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "Bot webhook is active ✅" });
}
