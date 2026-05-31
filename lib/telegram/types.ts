// lib/telegram/types.ts
export type ParsedTransaction = {
  type: "income" | "expense";
  amount: number;
  category: string;
  pocketName: string | null;
};

export type TelegramFrom = {
  id: number;
  username?: string;
  first_name?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramFrom;
  chat: { id: number };
  text?: string;
  voice?: { file_id: string; duration: number };
  photo?: Array<{ file_id: string; width: number; height: number }>;
  caption?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};
