"use client";

import { AlertTriangle, CalendarDays, Pencil, Trash2 } from "lucide-react";

import { CategoryBadge } from "@/components/common/category-badge";
import { Button } from "@/components/ui/button";
import type { Budget } from "@/hooks/useBudgets";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type BudgetCardProps = {
  budget: Budget;
  currency: string;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
};

const periodLabels: Record<Budget["period"], string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

const timeStatusLabels: Record<Budget["timeStatus"], string> = {
  active: "Aktif",
  expired: "Berakhir",
  upcoming: "Akan datang",
};

const usageStatusLabels: Record<Budget["usageStatus"], string> = {
  safe: "Aman",
  warning: "Mendekati limit",
  exceeded: "Melewati limit",
};

function progressTone(status: Budget["usageStatus"]) {
  if (status === "exceeded") {
    return "bg-rose-600";
  }

  if (status === "warning") {
    return "bg-amber-500";
  }

  return "bg-emerald-600";
}

function statusBadgeClass(status: Budget["usageStatus"]) {
  if (status === "exceeded") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "warning") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

export function BudgetCard({ budget, currency, onEdit, onDelete }: BudgetCardProps) {
  const progressWidth = Math.min(100, Math.max(0, budget.progress));

  return (
    <article className="flex min-h-[280px] flex-col rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CategoryBadge
            name={budget.category.name}
            icon={budget.category.icon}
            color={budget.category.color}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
              {periodLabels[budget.period]}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {timeStatusLabels[budget.timeStatus]}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onEdit(budget)}
            aria-label={`Edit budget ${budget.category.name}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => onDelete(budget)}
            aria-label={`Hapus budget ${budget.category.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Terpakai</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(budget.spent, currency)}
            </p>
          </div>
          <p className="text-right text-sm font-semibold">{budget.progress.toFixed(1)}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", progressTone(budget.usageStatus))}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Limit</p>
            <p className="font-medium">{formatCurrency(budget.limit, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sisa</p>
            <p className="font-medium">{formatCurrency(budget.remaining, currency)}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          <span>
            {formatDate(budget.startDate)} - {formatDate(budget.endDate)}
          </span>
        </div>
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            statusBadgeClass(budget.usageStatus),
          )}
        >
          {budget.usageStatus !== "safe" ? (
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          ) : null}
          {usageStatusLabels[budget.usageStatus]}
        </div>
      </div>
    </article>
  );
}
