// lib/telegram/callbacks.ts
import { editMessageText, answerCallbackQuery, sendForceReply } from "./api";
import {
  savedConfirmKeyboard,
  draftConfirmKeyboard,
  categoryPickerKeyboard,
  pocketPickerKeyboard,
} from "./keyboards";
import { resolveCategory, resolvePocket } from "./resolver";
import { formatRupiah } from "./parser";
import { createTransactionFromBot } from "@/lib/services/telegram.service";
import {
  getInteraction,
  deleteInteraction,
  setInteractionTransaction,
  setInteractionPendingAmount,
  updateInteractionPayload,
  getCategoryName,
  getPocketName,
  listCategoriesForUser,
  listPocketsForUser,
  updateTransactionCategory,
  updateTransactionPocket,
  deleteTransactionById,
  claimDraft,
  type DraftItem,
} from "@/lib/services/telegram.service";
import type { TelegramCallbackQuery } from "./types";

export type Callback =
  | { kind: "save" }
  | { kind: "cancel" }
  | { kind: "catMenu" }
  | { kind: "catPick"; id: string }
  | { kind: "pktMenu" }
  | { kind: "pktPick"; id: string }
  | { kind: "amt" }
  | { kind: "back" };

export function encodeCallback(cb: Callback): string {
  switch (cb.kind) {
    case "save": return "save";
    case "cancel": return "cancel";
    case "catMenu": return "cat";
    case "catPick": return `cat:${cb.id}`;
    case "pktMenu": return "pkt";
    case "pktPick": return `pkt:${cb.id}`;
    case "amt": return "amt";
    case "back": return "back";
  }
}

export function decodeCallback(data: string): Callback | null {
  const sep = data.indexOf(":");
  const prefix = sep === -1 ? data : data.slice(0, sep);
  const arg = sep === -1 ? "" : data.slice(sep + 1);

  switch (prefix) {
    case "save": return { kind: "save" };
    case "cancel": return { kind: "cancel" };
    case "cat": return arg ? { kind: "catPick", id: arg } : { kind: "catMenu" };
    case "pkt": return arg ? { kind: "pktPick", id: arg } : { kind: "pktMenu" };
    case "amt": return { kind: "amt" };
    case "back": return { kind: "back" };
    default: return null;
  }
}

function renderSaved(items: DraftItem[]): string {
  const lines = ["✅ <b>Tersimpan!</b>", ""];
  let total = 0;
  for (const it of items) {
    const icon = it.type === "income" ? "💰" : "💸";
    lines.push(`${icon} ${it.category} — ${formatRupiah(it.amount)}`);
    total += it.amount;
  }
  if (items.length > 1) lines.push("", `Total: ${formatRupiah(total)}`);
  return lines.join("\n");
}

export async function handleCallbackQuery(cb: TelegramCallbackQuery): Promise<void> {
  const message = cb.message;
  if (!message || !cb.data) {
    await answerCallbackQuery(cb.id);
    return;
  }
  const chatId = message.chat.id;
  const chatIdStr = String(chatId);
  const messageId = message.message_id;

  try {
    const decoded = decodeCallback(cb.data);
    const interaction = await getInteraction(chatIdStr, messageId);

    if (!decoded || !interaction) {
      await answerCallbackQuery(cb.id, "Sesi sudah berakhir. Kirim ulang transaksinya.");
      await editMessageText(chatId, messageId, message.text ?? "Sesi berakhir.", {});
      return;
    }

    const userId = interaction.userId;
    const items = (interaction.payload as DraftItem[] | null) ?? [];

    switch (decoded.kind) {
      case "save": {
        if (interaction.kind !== "draft") { await answerCallbackQuery(cb.id, "Sudah tersimpan."); return; }
        const claimed = await claimDraft(chatIdStr, messageId);
        if (!claimed) { await answerCallbackQuery(cb.id, "Sudah diproses."); return; }
        for (const it of items) {
          const categoryId = await resolveCategory(userId, it.category, it.type);
          const pocketId = it.pocketName ? await resolvePocket(userId, it.pocketName) : null;
          const created = await createTransactionFromBot({
            type: it.type, amount: it.amount, categoryId, pocketId,
            source: interaction.source as "text" | "voice" | "image",
            rawInput: null, telegramChatId: chatIdStr, userId,
          });
          if (items.length === 1) await setInteractionTransaction(chatIdStr, messageId, created.id);
        }
        if (items.length > 1) await deleteInteraction(chatIdStr, messageId);
        await editMessageText(chatId, messageId, renderSaved(items), {
          reply_markup: items.length === 1 ? savedConfirmKeyboard() : undefined,
        });
        await answerCallbackQuery(cb.id, "Tersimpan ✅");
        return;
      }

      case "cancel": {
        if (interaction.kind === "saved" && interaction.transactionId) {
          await deleteTransactionById(userId, interaction.transactionId);
        }
        await deleteInteraction(chatIdStr, messageId);
        await editMessageText(chatId, messageId, "❌ Dibatalkan.", {});
        await answerCallbackQuery(cb.id, "Dibatalkan");
        return;
      }

      case "catMenu": {
        const type = items[0]?.type ?? "expense";
        const cats = await listCategoriesForUser(userId, type);
        await editMessageText(chatId, messageId, message.text ?? "Pilih kategori:", {
          reply_markup: categoryPickerKeyboard(cats),
        });
        await answerCallbackQuery(cb.id);
        return;
      }

      case "catPick": {
        if (interaction.kind === "draft" && items.length !== 1) {
          await answerCallbackQuery(cb.id, "Tidak bisa mengubah item ganda.");
          return;
        }
        if (interaction.kind === "saved" && interaction.transactionId) {
          const ok = await updateTransactionCategory(userId, interaction.transactionId, decoded.id);
          if (!ok) {
            await editMessageText(chatId, messageId, "⚠️ Transaksi ini sudah tidak ada.", {});
            await deleteInteraction(chatIdStr, messageId);
            await answerCallbackQuery(cb.id, "Sudah tidak ada");
            return;
          }
        } else if (interaction.kind === "draft" && items.length === 1) {
          const name = await getCategoryName(userId, decoded.id);
          if (name) await updateInteractionPayload(chatIdStr, messageId, [{ ...items[0], category: name }]);
        }
        await editMessageText(chatId, messageId, message.text ?? "Kategori diubah.", {
          reply_markup: interaction.kind === "saved" ? savedConfirmKeyboard() : draftConfirmKeyboard(),
        });
        await answerCallbackQuery(cb.id, "Kategori diubah");
        return;
      }

      case "pktMenu": {
        const pockets = await listPocketsForUser(userId);
        if (pockets.length === 0) { await answerCallbackQuery(cb.id, "Belum ada kantong."); return; }
        await editMessageText(chatId, messageId, message.text ?? "Pilih kantong:", {
          reply_markup: pocketPickerKeyboard(pockets),
        });
        await answerCallbackQuery(cb.id);
        return;
      }

      case "pktPick": {
        if (interaction.kind === "draft" && items.length !== 1) {
          await answerCallbackQuery(cb.id, "Tidak bisa mengubah item ganda.");
          return;
        }
        if (interaction.kind === "saved" && interaction.transactionId) {
          const ok = await updateTransactionPocket(userId, interaction.transactionId, decoded.id);
          if (!ok) {
            await editMessageText(chatId, messageId, "⚠️ Transaksi ini sudah tidak ada.", {});
            await deleteInteraction(chatIdStr, messageId);
            await answerCallbackQuery(cb.id, "Sudah tidak ada");
            return;
          }
        } else if (interaction.kind === "draft" && items.length === 1) {
          const name = await getPocketName(userId, decoded.id);
          if (name) await updateInteractionPayload(chatIdStr, messageId, [{ ...items[0], pocketName: name }]);
        }
        await editMessageText(chatId, messageId, message.text ?? "Kantong diubah.", {
          reply_markup: interaction.kind === "saved" ? savedConfirmKeyboard() : draftConfirmKeyboard(),
        });
        await answerCallbackQuery(cb.id, "Kantong diubah");
        return;
      }

      case "amt": {
        const promptId = await sendForceReply(chatId, "💵 Ketik nominal baru (mis. 50rb):");
        if (promptId !== null) await setInteractionPendingAmount(chatIdStr, messageId, promptId);
        await answerCallbackQuery(cb.id);
        return;
      }

      case "back": {
        await editMessageText(chatId, messageId, message.text ?? "", {
          reply_markup: interaction.kind === "saved" ? savedConfirmKeyboard() : draftConfirmKeyboard(),
        });
        await answerCallbackQuery(cb.id);
        return;
      }
    }
  } catch (err) {
    console.error("[Bot] callback error:", err);
    await answerCallbackQuery(cb.id, "Terjadi kesalahan, coba lagi.");
  }
}
