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

export type TelegramVoice = { file_id: string; duration: number; mime_type?: string };
export type TelegramAudio = { file_id: string; duration: number; mime_type?: string };
export type TelegramVideoNote = { file_id: string; duration: number };
export type TelegramPhotoSize = { file_id: string; width: number; height: number };
export type TelegramDocument = {
  file_id: string;
  file_name?: string;
  mime_type?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramFrom;
  chat: { id: number };
  text?: string;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  video_note?: TelegramVideoNote;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  caption?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};
