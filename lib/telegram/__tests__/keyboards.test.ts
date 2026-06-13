// lib/telegram/__tests__/keyboards.test.ts
import { describe, it, expect } from "vitest";
import {
  savedConfirmKeyboard,
  draftConfirmKeyboard,
  draftSaveOnlyKeyboard,
  categoryPickerKeyboard,
  pocketPickerKeyboard,
} from "../keyboards";

function callbackData(kb: { inline_keyboard: { callback_data: string }[][] }): string[] {
  return kb.inline_keyboard.flat().map((b) => b.callback_data);
}

describe("keyboards", () => {
  it("saved confirm keyboard has cancel/cat/pkt/amt", () => {
    expect(callbackData(savedConfirmKeyboard())).toEqual(["cancel", "cat", "pkt", "amt"]);
  });

  it("draft confirm keyboard has save/cancel/cat/pkt/amt", () => {
    expect(callbackData(draftConfirmKeyboard())).toEqual(["save", "cancel", "cat", "pkt", "amt"]);
  });

  it("save-only draft keyboard has just save/cancel (multi-item drafts)", () => {
    expect(callbackData(draftSaveOnlyKeyboard())).toEqual(["save", "cancel"]);
  });

  it("category picker builds one button per category plus back", () => {
    const kb = categoryPickerKeyboard([
      { id: "a", name: "Makan" },
      { id: "b", name: "Transport" },
    ]);
    expect(callbackData(kb)).toEqual(["cat:a", "cat:b", "back"]);
  });

  it("pocket picker builds one button per pocket plus back", () => {
    const kb = pocketPickerKeyboard([{ id: "p1", name: "BCA" }]);
    expect(callbackData(kb)).toEqual(["pkt:p1", "back"]);
  });
});
