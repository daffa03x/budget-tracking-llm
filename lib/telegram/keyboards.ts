// lib/telegram/keyboards.ts
import { encodeCallback } from "./callbacks";

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export function savedConfirmKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "↩️ Batal", callback_data: encodeCallback({ kind: "cancel" }) },
        { text: "✏️ Kategori", callback_data: encodeCallback({ kind: "catMenu" }) },
        { text: "💼 Kantong", callback_data: encodeCallback({ kind: "pktMenu" }) },
        { text: "💵 Nominal", callback_data: encodeCallback({ kind: "amt" }) },
      ],
    ],
  };
}

export function draftConfirmKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Simpan", callback_data: encodeCallback({ kind: "save" }) },
        { text: "❌ Batal", callback_data: encodeCallback({ kind: "cancel" }) },
      ],
      [
        { text: "✏️ Kategori", callback_data: encodeCallback({ kind: "catMenu" }) },
        { text: "💼 Kantong", callback_data: encodeCallback({ kind: "pktMenu" }) },
        { text: "💵 Nominal", callback_data: encodeCallback({ kind: "amt" }) },
      ],
    ],
  };
}

// Multi-item drafts (multi-receipt photos) only support save/cancel — per-item
// editing is out of scope (see spec non-goals).
export function draftSaveOnlyKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Simpan", callback_data: encodeCallback({ kind: "save" }) },
        { text: "❌ Batal", callback_data: encodeCallback({ kind: "cancel" }) },
      ],
    ],
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function categoryPickerKeyboard(
  categories: { id: string; name: string }[],
): InlineKeyboard {
  const buttons: InlineButton[] = categories.map((c) => ({
    text: c.name,
    callback_data: encodeCallback({ kind: "catPick", id: c.id }),
  }));
  const rows = chunk(buttons, 2);
  rows.push([{ text: "⬅️ Kembali", callback_data: encodeCallback({ kind: "back" }) }]);
  return { inline_keyboard: rows };
}

export function pocketPickerKeyboard(
  pockets: { id: string; name: string }[],
): InlineKeyboard {
  const buttons: InlineButton[] = pockets.map((p) => ({
    text: p.name,
    callback_data: encodeCallback({ kind: "pktPick", id: p.id }),
  }));
  const rows = chunk(buttons, 2);
  rows.push([{ text: "⬅️ Kembali", callback_data: encodeCallback({ kind: "back" }) }]);
  return { inline_keyboard: rows };
}
