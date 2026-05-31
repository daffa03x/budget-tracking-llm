// lib/telegram/parser.ts
import type { ParsedTransaction } from "./types";

const EXPENSE_RE = /^(pengeluaran|keluar|beli|bayar|byr)\s+/i;
const INCOME_RE = /^(pemasukan|masuk|terima|gaji|dapat|dpt)\s+/i;
const POCKET_RE = /\s+(?:dari|ke)\s+(.+)$/i;
// Matches number at end: "50rb", "5jt", "500.000", "80000", "2.5jt", "25k"
const AMOUNT_RE = /^(.*?)\s+([\d][\d.,]*(?:[.,]\d+)?)\s*(rb|ribu|jt|juta|k)?\s*$/i;

function normalizeNumber(s: string, hasSuffix: boolean): number | null {
  const dotCount = (s.match(/\./g) ?? []).length;
  const commaCount = (s.match(/,/g) ?? []).length;

  if (dotCount === 0 && commaCount === 0) return parseFloat(s);

  if (hasSuffix) {
    if (dotCount === 1 && commaCount === 0) {
      // "2.5" → decimal; "1.500" → thousand separator
      const dec = s.split(".")[1];
      return dec.length <= 2 ? parseFloat(s) : parseFloat(s.replace(".", ""));
    }
    if (commaCount === 1 && dotCount === 0) {
      return parseFloat(s.replace(",", "."));
    }
  }

  // Indonesian: dots = thousand separators, comma = decimal
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function parseAmount(numStr: string, suffix: string): number | null {
  const n = normalizeNumber(numStr, suffix !== "");
  if (n === null || isNaN(n) || n <= 0) return null;
  const mult: Record<string, number> = {
    rb: 1_000,
    ribu: 1_000,
    jt: 1_000_000,
    juta: 1_000_000,
    k: 1_000,
  };
  return Math.round(n * (mult[suffix.toLowerCase()] ?? 1));
}

export function parseMessage(text: string): ParsedTransaction | null {
  const trimmed = text.trim();
  let type: "income" | "expense";
  let body: string;

  if (EXPENSE_RE.test(trimmed)) {
    type = "expense";
    body = trimmed.replace(EXPENSE_RE, "").trim();
  } else if (INCOME_RE.test(trimmed)) {
    type = "income";
    body = trimmed.replace(INCOME_RE, "").trim();
  } else {
    return null;
  }

  let pocketName: string | null = null;
  const pocketMatch = body.match(POCKET_RE);
  if (pocketMatch) {
    pocketName = pocketMatch[1].trim();
    body = body.slice(0, body.length - pocketMatch[0].length).trim();
  }

  const amountMatch = body.match(AMOUNT_RE);
  if (!amountMatch) return null;

  const [, categoryRaw, numStr, suffix = ""] = amountMatch;
  const amount = parseAmount(numStr, suffix);
  if (amount === null) return null;

  const catTrimmed = categoryRaw.trim();
  if (!catTrimmed) return null;

  const category = catTrimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return { type, amount, category, pocketName };
}

export function formatRupiah(amount: number): string {
  const result = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  // Normalize: ensure no space between "Rp" and the number
  return result.replace(/^Rp\s/, "Rp");
}
