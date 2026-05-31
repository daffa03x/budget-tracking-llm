import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, ReceiptText } from "lucide-react";

import { CategoryBadge } from "@/components/common/category-badge";
import type { RecentTransaction } from "@/lib/services/report.service";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type RecentTransactionsProps = {
  transactions: RecentTransaction[];
  currency: string;
};

export function RecentTransactions({ transactions, currency }: RecentTransactionsProps) {
  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Aktivitas Terbaru</h2>
          <p className="mt-1 text-sm text-muted-foreground">5 transaksi paling baru.</p>
        </div>
        <Link
          href="/transactions"
          className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Lihat semua
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="mt-6 flex min-h-56 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
          <ReceiptText className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Belum ada transaksi.</p>
          <Link
            href="/transactions"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Tambah transaksi
          </Link>
        </div>
      ) : (
        <div className="mt-5 divide-y">
          {transactions.map((transaction) => {
            const TypeIcon = transaction.type === "income" ? ArrowUpCircle : ArrowDownCircle;

            return (
              <div key={transaction.id} className="flex items-center gap-3 py-3">
                <TypeIcon
                  className={cn(
                    "size-5 shrink-0",
                    transaction.type === "income" ? "text-emerald-600" : "text-rose-600",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {transaction.description || "Tanpa deskripsi"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.category ? (
                      <CategoryBadge
                        name={transaction.category.name}
                        icon={transaction.category.icon}
                        color={transaction.category.color}
                      />
                    ) : null}
                  </div>
                </div>
                <p
                  className={cn(
                    "whitespace-nowrap text-sm font-semibold",
                    transaction.type === "income" ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {transaction.type === "income" ? "+" : "-"}
                  {formatCurrency(transaction.amount, currency)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
