// lib/telegram/api.ts
const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(
  chatId: number,
  text: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...options }),
  });
  if (!res.ok) {
    console.error(`[Telegram] sendMessage failed: ${res.status} ${await res.text()}`);
  }
}

export async function sendChatAction(
  chatId: number,
  action: "typing" | "upload_photo",
): Promise<void> {
  const res = await fetch(`${BASE}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
  if (!res.ok) {
    console.error(`[Telegram] sendChatAction failed: ${res.status}`);
  }
}

export async function getFileUrl(fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/getFile?file_id=${fileId}`);
  if (!res.ok) {
    throw new Error(`Telegram getFile failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { result: { file_path: string } };
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telegram file download failed: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
