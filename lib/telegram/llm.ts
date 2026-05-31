// lib/telegram/llm.ts
import type { ParsedTransaction } from "./types";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates[0].content.parts[0].text;
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

  const prompt = `Kamu adalah pembaca struk/receipt belanja. Analisis foto struk ini dan extract informasi transaksi.

Rules:
- Identifikasi TOTAL PEMBAYARAN (bukan subtotal per-item)
- Semua transaksi dari struk adalah expense
- Kategori dari nama toko atau jenis belanjaan (contoh: "Groceries", "Makan", "Transportasi")
- ${captionHint}
- Jika bukan foto struk/receipt, return array kosong
- Nominal dalam Rupiah (IDR)

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
