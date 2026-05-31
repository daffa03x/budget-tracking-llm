import Link from "next/link";
import { Target } from "lucide-react";

import type { BudgetOverviewItem } from "@/lib/services/report.service";
import { cn, formatCurrency } from "@/lib/utils";

type BudgetOverviewProps = {
  budgets: BudgetOverviewItem[];
  currency: string;
};

function progressTone(status: BudgetOverviewItem["usageStatus"]) {
  if (status === "exceeded") {
    return "bg-rose-600";
  }

  if (status === "warning") {
    return "bg-amber-500";
  }

  return "bg-emerald-600";
}

export function BudgetOverview({ budgets, currency }: BudgetOverviewProps) {
  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Budget Aktif</h2>
          <p className="mt-1 text-sm text-muted-foreground">Progress tertinggi bulan ini.</p>
        </div>
        <Link
          href="/budgets"
          className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Kelola
        </Link>
      </div>

      {budgets.length === 0 ? (
        <div className="mt-6 flex min-h-56 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
          <Target className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Belum ada budget aktif.</p>
          <Link
            href="/budgets"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Buat budget
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {budgets.map((budget) => (
            <div key={budget.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{budget.category.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(budget.spent, currency)} dari{" "}
                    {formatCurrency(budget.limit, currency)}
                  </p>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold">
                  {budget.progress.toFixed(1)}%
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", progressTone(budget.usageStatus))}
                  style={{ width: `${Math.min(100, Math.max(0, budget.progress))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
