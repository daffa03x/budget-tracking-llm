// lib/telegram/stt.ts

// Maps an audio mime type to a filename extension Groq/Whisper accepts.
// Telegram voice notes are OGG/Opus; forwarded audio can be mp3/m4a/wav/etc.
function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/oga": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/flac": "flac",
    "video/mp4": "mp4", // Telegram video notes
  };
  return map[mimeType.toLowerCase()] ?? "ogg";
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg",
): Promise<string> {
  const ext = extensionFor(mimeType);
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer as unknown as ArrayBuffer], { type: mimeType }),
    `audio.${ext}`,
  );
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "id");
  formData.append("response_format", "text");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Groq STT error: ${res.status} ${await res.text()}`);
  }

  return (await res.text()).trim();
}
