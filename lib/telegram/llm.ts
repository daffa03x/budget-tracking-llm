// lib/telegram/llm.ts
import type { ParsedTransaction } from "./types";

// gemini-2.0-flash has no free-tier quota on some projects (returns 429
// limit: 0); 2.5-flash works and is stronger at receipt OCR. Override with
// GEMINI_MODEL if needed.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

// Strips ```json ... ``` / ``` ... ``` fences that some model responses wrap
// JSON in, even when responseMimeType is requested.
function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function callGemini(parts: unknown[]): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini blocked: ${blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    const finish = data.candidates?.[0]?.finishReason ?? "no candidates";
    throw new Error(`Gemini returned no text (${finish})`);
  }

  return stripJsonFence(text);
}

export async function extractTransactionFromText(
  text: string,
): Promise<ParsedTransaction | null> {
  const prompt = `Kamu adalah parser transaksi keuangan. Extract informasi transaksi dari pesan bahasa Indonesia berikut.

Rules:
- Tentukan apakah ini income atau expense
- Extract nominal dalam angka (bukan string)
- Extract kategori singkat (1-2 kata, capitalize)
- Jika bukan transaksi keuangan, return null
- Konversi angka dalam kata: "lima puluh ribu" = 50000, "tiga juta" = 3000000
- Slang: "goceng" = 5000, "ceban" = 10000, "cepek" = 100000

Respond ONLY with JSON (no markdown):
{"type": "income" | "expense", "amount": number, "category": "string"}

Atau jika bukan transaksi:
null

Pesan: "${text.replace(/"/g, '\\"')}"`;

  const raw = await callGemini([{ text: prompt }]);

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!["income", "expense"].includes(parsed.type)) return null;
    if (typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
    if (typeof parsed.category !== "string") return null;
    return {
      type: parsed.type as "income" | "expense",
      amount: parsed.amount,
      category: parsed.category,
      pocketName: null,
    };
  } catch {
    return null;
  }
}

export async function extractTransactionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  caption?: string,
): Promise<ParsedTransaction[]> {
  const base64 = imageBuffer.toString("base64");
  const captionHint = caption ? `Caption dari user: "${caption}"` : "";

  const prompt = `Kamu adalah pembaca struk/receipt belanja. Analisis foto ini dan extract informasi transaksi.

Rules:
- Hasilkan SATU entry per struk, memakai TOTAL PEMBAYARAN struk tersebut (grand total / "Total", bukan subtotal dan bukan harga per-item).
- Jika dalam foto ada beberapa struk terpisah, buat satu entry untuk tiap struk.
- JANGAN pecah satu struk menjadi banyak entry per item.
- Semua transaksi dari struk adalah expense.
- Kategori dari nama toko atau jenis belanjaan (contoh: "Groceries", "Makan", "Transportasi").
- ${captionHint}
- Jika bukan foto struk/receipt, return array kosong.
- Nominal dalam Rupiah (IDR), angka murni tanpa titik/koma pemisah.

Respond ONLY with JSON array (no markdown):
[{"type": "expense", "amount": number, "category": "string"}]

Atau jika bukan struk:
[]`;

  const raw = await callGemini([
    { inlineData: { mimeType, data: base64 } },
    { text: prompt },
  ]);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { type: "expense"; amount: number; category: string } =>
          item?.type === "expense" &&
          typeof item.amount === "number" &&
          item.amount > 0 &&
          typeof item.category === "string",
      )
      .map((item) => ({
        type: "expense" as const,
        amount: item.amount,
        category: item.category,
        pocketName: null,
      }));
  } catch {
    return [];
  }
}
