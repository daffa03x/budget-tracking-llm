// app/api/telegram/setup/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !appUrl || !secret) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  let data: unknown;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        secret_token: secret,
      }),
    });
    data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: "Telegram API error", webhook_url: webhookUrl, telegram_response: data },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach Telegram API", detail: String(err) }, { status: 502 });
  }

  return NextResponse.json({ webhook_url: webhookUrl, telegram_response: data });
}
