// lib/telegram/handler.ts
import { sendMessage, sendChatAction, downloadFile } from "./api";
import { parseMessage, formatRupiah } from "./parser";
import { transcribeAudio } from "./stt";
import { extractTransactionFromText, extractTransactionFromImage } from "./llm";
import { resolveCategory, resolvePocket } from "./resolver";
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getRecentTransactions,
  deleteLastTransaction,
} from "./report";
import { createTransactionFromBot, getLinkedUserId } from "@/lib/services/telegram.service";
import { prisma } from "@/lib/prisma";
import type { ParsedTransaction, TelegramFrom, TelegramUpdate } from "./types";

const NOT_LINKED =
  `❌ Akun belum terhubung.\n\n` +
  `<b>Cara menghubungkan:</b>\n` +
  `1. Buka website budget tracker\n` +
  `2. Pergi ke Settings → Telegram Bot\n` +
  `3. Klik "Hubungkan Telegram" → klik link yang muncul`;

const HELP =
  `🤖 <b>Budget Bot</b>\n\n` +
  `<b>Catat transaksi:</b>\n` +
  `📝 Teks: <code>pengeluaran makan 50rb</code>\n` +
  `🎙️ Voice note: ucapkan transaksimu\n` +
  `📷 Foto struk: kirim foto receipt\n\n` +
  `<b>Format teks:</b>\n` +
  `• <code>pengeluaran [kategori] [nominal]</code>\n` +
  `• <code>pemasukan [kategori] [nominal]</code>\n` +
  `• Nominal: 50rb · 5jt · 25k · 500.000\n\n` +
  `<b>Laporan:</b>\n` +
  `/hari · /minggu · /bulan\n` +
  `/bulan 3 · /bulan 3 2025\n\n` +
  `<b>Lainnya:</b>\n` +
  `/riwayat [n] · /hapus · /status`;

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);

  try {
    if (msg.text?.startsWith("/")) {
      await handleCommand(chatId, chatIdStr, msg.text, msg.from);
      return;
    }

    if (msg.text) {
      await handleText(chatId, chatIdStr, msg.text);
      return;
    }

    if (msg.voice) {
      await handleVoice(chatId, chatIdStr, msg.voice.file_id);
      return;
    }

    if (msg.photo && msg.photo.length > 0) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await handlePhoto(chatId, chatIdStr, fileId, msg.caption);
      return;
    }

    await sendMessage(
      chatId,
      "Saya hanya bisa memproses teks, voice note, dan foto struk. Ketik /help untuk panduan.",
    );
  } catch (err) {
    console.error("[Bot] unhandled error:", err);
  }
}

async function handleText(chatId: number, chatIdStr: string, text: string): Promise<void> {
  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  const parsed = parseMessage(text);
  if (parsed) {
    await saveAndConfirm(chatId, chatIdStr, userId, parsed, "text", text);
    return;
  }

  try {
    const llmResult = await extractTransactionFromText(text);
    if (llmResult) {
      await saveAndConfirm(chatId, chatIdStr, userId, llmResult, "text", text);
      return;
    }
  } catch {
    await sendMessage(chatId, "🤖 Layanan AI sedang sibuk. Coba format: pengeluaran [kategori] [nominal]");
    return;
  }

  await sendMessage(chatId, "Tidak bisa memproses pesan ini sebagai transaksi.\n\nContoh: <code>pengeluaran makan siang 50rb</code>");
}

async function handleVoice(chatId: number, chatIdStr: string, fileId: string): Promise<void> {
  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  await sendChatAction(chatId, "typing");

  let buffer: Buffer;
  try {
    buffer = await downloadFile(fileId);
  } catch {
    await sendMessage(chatId, "Gagal mengunduh file. Coba kirim ulang.");
    return;
  }

  let transcript: string;
  try {
    transcript = await transcribeAudio(buffer);
  } catch {
    await sendMessage(chatId, "🎙️ Layanan transkripsi sedang sibuk. Coba lagi dalam 1 menit, atau ketik manual.");
    return;
  }

  await sendMessage(chatId, `🎙️ <i>"${transcript}"</i>`);

  const parsed = parseMessage(transcript);
  if (parsed) {
    await saveAndConfirm(chatId, chatIdStr, userId, parsed, "voice", transcript);
    return;
  }

  try {
    const llmResult = await extractTransactionFromText(transcript);
    if (llmResult) {
      await saveAndConfirm(chatId, chatIdStr, userId, llmResult, "voice", transcript);
      return;
    }
  } catch {
    // fall through
  }

  await sendMessage(chatId, "Maaf, tidak bisa memahami voice note ini sebagai transaksi.\nCoba format: pengeluaran [kategori] [nominal]");
}

async function handlePhoto(
  chatId: number,
  chatIdStr: string,
  fileId: string,
  caption?: string,
): Promise<void> {
  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  await sendChatAction(chatId, "typing");

  let buffer: Buffer;
  try {
    buffer = await downloadFile(fileId);
  } catch {
    await sendMessage(chatId, "Gagal mengunduh foto. Coba kirim ulang.");
    return;
  }

  let results: ParsedTransaction[];
  try {
    results = await extractTransactionFromImage(buffer, "image/jpeg", caption);
  } catch {
    await sendMessage(chatId, "🤖 Layanan AI sedang sibuk. Coba lagi sebentar.");
    return;
  }

  if (results.length === 0) {
    await sendMessage(chatId, "Maaf, tidak bisa membaca foto ini sebagai struk belanja.\nPastikan foto struk-nya jelas dan tidak terpotong.");
    return;
  }

  const lines = ["📷 <b>Struk terbaca!</b>", ""];
  let total = 0;
  let savedCount = 0;

  for (const r of results) {
    try {
      const categoryId = await resolveCategory(userId, r.category, r.type);
      await createTransactionFromBot({
        type: r.type,
        amount: r.amount,
        categoryId,
        pocketId: null,
        source: "image",
        rawInput: caption ?? null,
        telegramChatId: chatIdStr,
        userId,
      });
      lines.push(`💸 ${r.category} — ${formatRupiah(r.amount)}`);
      total += r.amount;
      savedCount++;
    } catch (err) {
      console.error("[Bot] handlePhoto item failed:", err);
      lines.push(`⚠️ ${r.category} — gagal disimpan`);
    }
  }

  if (savedCount === 0) {
    await sendMessage(chatId, "Gagal menyimpan transaksi dari struk. Coba kirim ulang.");
    return;
  }

  lines.push("", `Total: ${formatRupiah(total)} (${savedCount} dari ${results.length} transaksi dicatat)`);
  await sendMessage(chatId, lines.join("\n"));
}

async function saveAndConfirm(
  chatId: number,
  chatIdStr: string,
  userId: string,
  parsed: ParsedTransaction,
  source: "text" | "voice",
  rawInput: string,
): Promise<void> {
  const categoryId = await resolveCategory(userId, parsed.category, parsed.type);
  let pocketId: string | null = null;
  if (parsed.pocketName) {
    pocketId = await resolvePocket(userId, parsed.pocketName);
  }

  await createTransactionFromBot({
    type: parsed.type,
    amount: parsed.amount,
    categoryId,
    pocketId,
    source,
    rawInput,
    telegramChatId: chatIdStr,
    userId,
  });

  const typeIcon = parsed.type === "income" ? "💰" : "💸";
  const typeLabel = parsed.type === "income" ? "Pemasukan" : "Pengeluaran";
  const pocketLine = pocketId ? `\n💼 Kantong: ${parsed.pocketName}` : "";
  const date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

  await sendMessage(
    chatId,
    `✅ Tercatat!\n\n${typeIcon} ${typeLabel}: ${parsed.category}\n💵 ${formatRupiah(parsed.amount)}${pocketLine}\n📅 ${date}`,
  );
}

async function handleCommand(
  chatId: number,
  chatIdStr: string,
  text: string,
  from: TelegramFrom | undefined,
): Promise<void> {
  const [rawCmd, ...args] = text.split(" ");
  const cmd = rawCmd.split("@")[0].toLowerCase();

  if (cmd === "/start") {
    if (args.length > 0) {
      await handleStartToken(chatId, chatIdStr, args[0], from);
    } else {
      const userId = await getLinkedUserId(chatIdStr);
      await sendMessage(
        chatId,
        userId ? `✅ Akun sudah terhubung! Ketik /help untuk panduan.` : NOT_LINKED,
      );
    }
    return;
  }

  if (cmd === "/help") {
    await sendMessage(chatId, HELP);
    return;
  }

  const userId = await getLinkedUserId(chatIdStr);
  if (!userId) { await sendMessage(chatId, NOT_LINKED); return; }

  switch (cmd) {
    case "/hari":
      await sendMessage(chatId, await generateDailyReport(userId));
      break;
    case "/minggu":
      await sendMessage(chatId, await generateWeeklyReport(userId));
      break;
    case "/bulan": {
      const monthRaw = args[0] ? parseInt(args[0]) : NaN;
      const yearRaw = args[1] ? parseInt(args[1]) : NaN;
      const month = !isNaN(monthRaw) ? monthRaw : undefined;
      const year = !isNaN(yearRaw) ? yearRaw : undefined;
      await sendMessage(chatId, await generateMonthlyReport(userId, month, year));
      break;
    }
    case "/riwayat": {
      const limitRaw = args[0] ? parseInt(args[0]) : NaN;
      const limit = !isNaN(limitRaw) && limitRaw > 0 ? limitRaw : 5;
      await sendMessage(chatId, await getRecentTransactions(userId, limit));
      break;
    }
    case "/hapus":
      await sendMessage(chatId, await deleteLastTransaction(userId));
      break;
    case "/status": {
      const link = await prisma.telegramLink.findFirst({
        where: { chatId: chatIdStr, linked: true },
        select: { username: true, firstName: true, createdAt: true },
      });
      if (!link) {
        await sendMessage(chatId, "❌ Akun belum terhubung.");
      } else {
        const since = link.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
        await sendMessage(chatId, `✅ <b>Status: Terhubung</b>\n👤 ${link.firstName ?? ""} (@${link.username ?? "-"})\n📅 Sejak: ${since}`);
      }
      break;
    }
    default:
      await sendMessage(chatId, "Perintah tidak dikenal. Ketik /help untuk panduan.");
  }
}

async function handleStartToken(
  chatId: number,
  chatIdStr: string,
  token: string,
  from: TelegramFrom | undefined,
): Promise<void> {
  const link = await prisma.telegramLink.findUnique({
    where: { token },
    select: { id: true, userId: true, linked: true, expiresAt: true },
  });

  if (!link) {
    await sendMessage(chatId, "❌ Token tidak valid."); return;
  }
  if (link.linked) {
    await sendMessage(chatId, "❌ Token sudah digunakan."); return;
  }
  if (link.expiresAt < new Date()) {
    await prisma.telegramLink.delete({ where: { token } });
    await sendMessage(chatId, "❌ Token sudah expired. Generate link baru di website."); return;
  }

  const existingLink = await prisma.telegramLink.findFirst({
    where: { chatId: chatIdStr, linked: true },
  });
  if (existingLink && existingLink.userId !== link.userId) {
    await sendMessage(chatId, "⚠️ Chat ini sudah terhubung ke akun lain. Putuskan koneksi dulu di website."); return;
  }

  await prisma.telegramLink.update({
    where: { token },
    data: {
      chatId: chatIdStr,
      username: from?.username ?? null,
      firstName: from?.first_name ?? null,
      linked: true,
    },
  });

  await sendMessage(
    chatId,
    `✅ <b>Akun berhasil terhubung!</b>\n\nSekarang kamu bisa:\n• Kirim teks: <code>pengeluaran makan 50rb</code>\n• Kirim voice note\n• Kirim foto struk\n\nKetik /help untuk panduan lengkap.`,
  );
}
