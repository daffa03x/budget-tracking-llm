// lib/telegram/stt.ts
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer as unknown as ArrayBuffer], { type: "audio/ogg" }),
    "audio.ogg",
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

  return res.text();
}
