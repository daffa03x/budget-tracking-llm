# Telegram Bot — Confirmation & Correction Loop

**Date:** 2026-06-13
**Status:** Approved (design)
**Scope:** Single implementation plan

## Problem

The Telegram bot auto-saves parsed transactions with no confirmation. For
AI-parsed text and receipt photos, a wrong amount or category is saved silently.
The only correction is `/hapus`, which blindly deletes the last transaction.
There are no inline keyboards or buttons anywhere in the bot.

This degrades accuracy (the inherent weakness of an LLM-driven bot: it auto-saves
its own guesses) and leaves a UX gap (no undo/edit per transaction).

## Goal

Add a button-driven confirmation and correction layer on top of the existing
handler, using a **hybrid by-confidence** save flow:

- **High confidence** (regex parser match) → save immediately, attach undo/edit
  buttons.
- **Low confidence** (AI text parse, receipt photo) → preview first, save only
  after the user taps ✅ Simpan.

Corrections available via buttons: change category, set/change pocket, undo, and
edit amount (reply flow).

## Non-goals (YAGNI)

- No remaining-budget / daily-total / pocket-balance feedback in the confirmation
  message (explicitly dropped by the user — keep messages concise).
- No async/queue webhook processing (separate reliability track).
- No bulk per-item amount editing for multi-receipt drafts (edit applies per
  saved transaction).

## Core design

Every bot message that carries buttons is identified by **its own
`message_id`** (a small integer Telegram assigns), not by stuffing IDs into
`callback_data` (which has a 64-byte limit). The context for each interactive
message lives in a single `TelegramInteraction` row keyed by
`(chatId, messageId)`. On a `callback_query`, we look up the row by the callback
message's `chat.id` + `message.message_id` to recover full context;
`callback_data` then only needs to carry the action and an optional short
argument (e.g. a chosen `categoryId`).

Two interaction kinds:

- **`draft`** (not yet saved) — for the low-confidence path. The parsed payload
  is stored; no DB transaction is created until the user taps ✅ Simpan.
- **`saved`** (already saved) — for the high-confidence path. The transaction is
  created immediately; the interaction row holds its `transactionId` for
  undo/edit.

## Flows

### High-confidence (regex parser matches)
1. Save the transaction immediately (current behavior).
2. Send a concise confirmation with keyboard:
   `↩️ Batal · ✏️ Kategori · 💼 Kantong · 💵 Nominal`.
3. Record a `saved` interaction row with the `transactionId`.

### Low-confidence (AI text parse / receipt photo)
1. Do **not** save. Show a preview message with keyboard:
   `✅ Simpan · ❌ Batal · ✏️ Kategori · 💼 Kantong · 💵 Nominal`
   (pocket matters most here — voice/AI can't extract it).
2. Tap ✅ → create the transaction(s), edit the message into a saved
   confirmation, flip the interaction row to `saved`.
3. Multi-receipt photo → one preview listing all items; ✅ saves all of them.

### Category / pocket picker
- Tap ✏️ Kategori → replace the keyboard with the user's categories as buttons
  (paged if many). Tapping one updates the draft or saved transaction, then
  returns to the confirmation keyboard.
- Pocket picker works the same via 💼 Kantong.

### Amount edit (reply flow)
- Tap 💵 Nominal → bot sends a `force_reply` prompt "Ketik nominal baru".
- The user's reply is matched via `reply_to_message_id` to the interaction whose
  `pendingField = amount`, parsed with the existing amount parser, and applied.
- Invalid input → re-prompt; the draft/transaction stays intact.

## Data model

```prisma
enum TelegramInteractionKind {
  draft
  saved
}

enum TelegramPendingField {
  none
  amount
}

model TelegramInteraction {
  id            String                  @id @default(cuid())
  chatId        String
  messageId     Int                     // message_id of the interactive bot message
  userId        String
  kind          TelegramInteractionKind
  transactionId String?                 // set when kind=saved (or after a draft is saved)
  payload       Json?                   // draft: [{ type, amount, category, pocketName }]
  pendingField  TelegramPendingField    @default(none)
  expiresAt     DateTime                // drafts expire (e.g. 1h) → buttons go stale
  createdAt     DateTime                @default(now())

  @@unique([chatId, messageId])
  @@index([expiresAt])
}
```

- Idempotency for callbacks reuses the existing `update_id` dedup
  (`claimTelegramUpdate`).
- Cleanup is lazy: check `expiresAt` when a callback arrives; no cron.
- `transactionId` is a CUID (~25 chars) and is never placed in `callback_data`
  for two-ID actions; the `(chatId, messageId)` key avoids the 64-byte limit.

## `callback_data` encoding

Compact `action[:arg]`, where the message identity comes from the callback's
`message.message_id`, not the data:

- `save` — save the draft
- `cancel` — discard draft / undo saved transaction
- `cat` — open category picker
- `cat:<categoryId>` — pick category
- `pkt` — open pocket picker
- `pkt:<pocketId>` — pick pocket
- `amt` — start amount edit (sets `pendingField=amount`, sends force_reply)
- `back` — return to the confirmation keyboard

All stay well under 64 bytes (longest = `cat:` + one CUID ≈ 29 chars).

## Components touched

- `lib/telegram/api.ts` — `sendMessage` gains optional `reply_markup`; add
  `editMessageText`, `editMessageReplyMarkup`, `answerCallbackQuery`,
  `sendForceReply`.
- `lib/telegram/types.ts` — add `callback_query`, `reply_to_message`, and
  inline-keyboard payload types.
- `app/api/telegram/webhook/route.ts` — route `update.callback_query`
  (dedup via existing `update_id` claim).
- `lib/telegram/keyboards.ts` (new) — pure keyboard builders.
- `lib/telegram/callbacks.ts` (new) — callback_query handler; loads the
  interaction row, applies the action, edits the message. Keeps `handler.ts`
  thin.
- `lib/telegram/handler.ts` — `saveAndConfirm` and `handleImage` attach
  keyboards; the AI/photo paths create a `draft` instead of saving directly.
- `lib/services/telegram.service.ts` — add `updateTransactionCategory`,
  `updateTransactionPocket`, `updateTransactionAmount`, `deleteTransactionById`
  (all validate `userId` ownership); interaction-row CRUD helpers.

## Error handling & edge cases

- Stale/expired draft button → `answerCallbackQuery` "Sesi sudah berakhir, kirim
  ulang.", remove the keyboard.
- Double-tap / race → idempotency via `update_id` plus checking the row `kind`
  (e.g. a `save` on an already-saved row is a no-op).
- Ownership → every update/delete derives `userId` from the linked chat
  (`getLinkedUserId`), never from callback data.
- Invalid amount reply → re-prompt; interaction row unchanged.
- Category/pocket lists with many entries → paginate the inline keyboard.

## Testing (Vitest, following existing `lib/telegram/__tests__` patterns)

- Keyboard builders produce expected inline-keyboard structures.
- `callback_data` encode/decode round-trips and stays ≤64 bytes.
- Amount-reply parsing (reuses parser; covers invalid input).
- Interaction state transitions: `draft → saved`, category swap, pocket set,
  undo. Service update/delete tested with mocked Prisma as in current tests.

## Build sequence (high level)

1. Schema: add `TelegramInteraction` model + migration; `prisma generate`.
2. API helpers (`editMessageText`, `answerCallbackQuery`, `sendForceReply`,
   `reply_markup`) + types.
3. Keyboard builders + `callback_data` codec (with tests).
4. Service: ownership-checked update/delete + interaction CRUD.
5. Wire high-confidence path (save + buttons + undo/edit).
6. Wire low-confidence path (draft preview → save).
7. Category/pocket pickers.
8. Amount-edit reply flow.
9. Webhook routing for `callback_query` + lazy expiry.
10. Tests + lint + build verification.
