import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "IDR") {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(amount);
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function groupTransactionsByDate<T extends { date: Date | string }>(transactions: T[]) {
  return transactions.reduce<Record<string, T[]>>((groups, transaction) => {
    const key = new Date(transaction.date).toISOString().slice(0, 10);

    groups[key] = groups[key] ?? [];
    groups[key].push(transaction);

    return groups;
  }, {});
}

export function calculateBudgetProgress(spent: number, limit: number) {
  if (!Number.isFinite(spent) || !Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return Math.round((spent / limit) * 1000) / 10;
}
