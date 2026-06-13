// lib/telegram/parser.ts
import type { ParsedTransaction } from "./types";

const EXPENSE_RE = /^(pengeluaran|keluar|beli|bayar|byr)\s+/i;
const INCOME_RE = /^(pemasukan|masuk|terima|gaji|dapat|dpt)\s+/i;
const POCKET_RE = /\s+(?:dari|ke)\s+(.+)$/i;
// Matches number at end: "50rb", "5jt", "500.000", "80000", "2.5jt", "25k"
const AMOUNT_RE = /^(.*?)\s+([\d][\d.,]*(?:[.,]\d+)?)\s*(rb|ribu|jt|juta|k)?\s*$/i;

const WORD_ONES: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
};

// All valid Indonesian number words (used to detect trailing word-number sequence)
const NUMBER_WORD_SET = new Set([
  "satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan",
  "sepuluh","sebelas","seratus","seribu","puluh","belas","ratus","ribu","juta",
]);

// Words that are actual digit-words (not just scale suffixes like ribu/juta)
const DIGIT_WORD_SET = new Set([
  "satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan",
  "sepuluh","sebelas","seratus","seribu","puluh","belas",
]);

function parseIndonesianWordNumber(tokens: string[]): number | null {
  // Expand compound words: seratus→[satu,ratus], seribu→[satu,ribu], etc.
  const exp: string[] = [];
  for (const t of tokens) {
    if (t === "seratus") exp.push("satu", "ratus");
    else if (t === "seribu") exp.push("satu", "ribu");
    else if (t === "sepuluh") exp.push("satu", "puluh");
    else if (t === "sebelas") exp.push("satu", "belas");
    else exp.push(t);
  }

  let grandTotal = 0;
  let total = 0;
  let last = 0;

  for (const t of exp) {
    if (WORD_ONES[t] !== undefined) {
      total += last;
      last = WORD_ONES[t];
    } else if (t === "belas") {
      last = last + 10;
    } else if (t === "puluh") {
      last = (last || 1) * 10;
    } else if (t === "ratus") {
      total += (last || 1) * 100;
      last = 0;
    } else if (t === "ribu") {
      total += last;
      last = 0;
      grandTotal += (total || 1) * 1_000;
      total = 0;
    } else if (t === "juta") {
      total += last;
      last = 0;
      grandTotal += (total || 1) * 1_000_000;
      total = 0;
    } else {
      return null;
    }
  }

  total += last;
  grandTotal += total;
  return grandTotal > 0 ? grandTotal : null;
}

// Converts trailing Indonesian word-numbers to digits, e.g.:
// "makanan dua puluh ribu" → "makanan 20000"
function normalizeWordAmount(text: string): string {
  const words = text.toLowerCase().trim().split(/\s+/);

  let numStart = words.length;
  while (numStart > 0 && NUMBER_WORD_SET.has(words[numStart - 1])) numStart--;

  if (numStart === words.length) return text;

  const numWords = words.slice(numStart);
  const hasActualDigit = numWords.some((w) => DIGIT_WORD_SET.has(w));
  if (!hasActualDigit) return text;

  const categoryWords = words.slice(0, numStart);
  if (categoryWords.length === 0) return text;

  const amount = parseIndonesianWordNumber(numWords);
  if (amount === null) return text;

  return [...categoryWords, String(amount)].join(" ");
}

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
  // Strip trailing sentence punctuation — STT transcripts often end with "."
  // (e.g. "pengeluaran makan lima puluh ribu."), which would otherwise break
  // the trailing word-number / amount match.
  const trimmed = text.trim().replace(/[.!?;:]+$/, "").trim();
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

  const bodyToMatch = normalizeWordAmount(body);
  const amountMatch = bodyToMatch.match(AMOUNT_RE);
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
