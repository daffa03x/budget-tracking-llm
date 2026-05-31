// lib/telegram/report.ts
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "./parser";
import { syncBudgetsForExpenseChange } from "@/lib/services/budget.service";

const TZ = "Asia/Jakarta";

async function buildReport(
  userId: string,
  from: Date,
  to: Date,
  label: string,
): Promise<string> {
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: from, lte: to } },
    select: {
      type: true,
      amount: true,
      category: { select: { name: true } },
    },
  });

  if (rows.length === 0) {
    return `📊 <b>Laporan ${label}</b>\n\nBelum ada transaksi.`;
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Record<string, number> = {};

  for (const r of rows) {
    const a = Number(r.amount);
    if (r.type === "income") {
      totalIncome += a;
    } else {
      totalExpense += a;
      const cat = r.category?.name ?? "Lainnya";
      byCategory[cat] = (byCategory[cat] ?? 0) + a;
    }
  }

  const lines = [
    `📊 <b>Laporan ${label}</b>`,
    "",
    `💰 Pemasukan : <b>${formatRupiah(totalIncome)}</b>`,
    `💸 Pengeluaran: <b>${formatRupiah(totalExpense)}</b>`,
    `📈 Saldo      : <b>${formatRupiah(totalIncome - totalExpense)}</b>`,
  ];

  const cats = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  if (cats.length > 0) {
    lines.push("", "<b>Breakdown pengeluaran:</b>");
    for (const [cat, amt] of cats) {
      lines.push(`  • ${cat}: ${formatRupiah(amt)}`);
    }
  }

  lines.push("", `Total transaksi: ${rows.length}`);
  return lines.join("\n");
}

export async function generateDailyReport(userId: string): Promise<string> {
  const now = toZonedTime(new Date(), TZ);
  return buildReport(
    userId,
    fromZonedTime(startOfDay(now), TZ),
    fromZonedTime(endOfDay(now), TZ),
    "Hari Ini",
  );
}

export async function generateWeeklyReport(userId: string): Promise<string> {
  const now = toZonedTime(new Date(), TZ);
  return buildReport(
    userId,
    fromZonedTime(startOfWeek(now, { weekStartsOn: 1 }), TZ),
    fromZonedTime(endOfWeek(now, { weekStartsOn: 1 }), TZ),
    "Minggu Ini",
  );
}

export async function generateMonthlyReport(
  userId: string,
  month?: number,
  year?: number,
): Promise<string> {
  const now = toZonedTime(new Date(), TZ);
  const d = new Date(year ?? now.getFullYear(), month !== undefined ? month - 1 : now.getMonth(), 1);
  const label = d.toLocaleString("id-ID", { month: "long", year: "numeric", timeZone: TZ });
  return buildReport(
    userId,
    fromZonedTime(startOfMonth(d), TZ),
    fromZonedTime(endOfMonth(d), TZ),
    label,
  );
}

export async function getRecentTransactions(
  userId: string,
  limit = 5,
): Promise<string> {
  const sourceIcon: Record<string, string> = {
    text: "📝",
    voice: "🎙️",
    image: "📷",
    web: "🌐",
  };

  const rows = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      type: true,
      amount: true,
      source: true,
      date: true,
      category: { select: { name: true } },
    },
  });

  if (rows.length === 0) return "📋 Belum ada riwayat transaksi.";

  const lines = [`📋 <b>${limit} Transaksi Terakhir</b>`, ""];
  for (const r of rows) {
    const icon = sourceIcon[r.source] ?? "📝";
    const typeIcon = r.type === "income" ? "💰" : "💸";
    const date = new Date(r.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: TZ,
    });
    lines.push(
      `${icon}${typeIcon} ${r.category?.name ?? "Lainnya"} — ${formatRupiah(Number(r.amount))} (${date})`,
    );
  }
  return lines.join("\n");
}

export async function deleteLastTransaction(userId: string): Promise<string> {
  const last = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, type: true, categoryId: true, date: true, category: { select: { name: true } } },
  });

  if (!last) return "Tidak ada transaksi yang bisa dihapus.";

  await prisma.transaction.delete({ where: { id: last.id } });

  if (last.type === "expense") {
    await syncBudgetsForExpenseChange(userId, [
      { type: last.type, categoryId: last.categoryId, date: last.date },
    ]);
  }

  const typeStr = last.type === "income" ? "Pemasukan" : "Pengeluaran";
  return `✅ Dihapus: ${typeStr} ${last.category?.name ?? "Lainnya"} ${formatRupiah(Number(last.amount))}`;
}
