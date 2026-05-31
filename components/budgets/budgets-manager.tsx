"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { CircleAlert, Plus, RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";

import { BudgetCard } from "@/components/budgets/budget-card";
import { BudgetFormDialog } from "@/components/budgets/budget-form-dialog";
import { DeleteBudgetDialog } from "@/components/budgets/delete-budget-dialog";
import { Button } from "@/components/ui/button";
import { type Category, useCategories } from "@/hooks/useCategories";
import {
  type Budget,
  type BudgetTimeStatus,
  type BudgetUsageStatus,
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from "@/hooks/useBudgets";
import type { BudgetInput } from "@/lib/validations/budget.schema";
import { cn, formatCurrency } from "@/lib/utils";

const emptyBudgets: Budget[] = [];
const emptyCategories: Category[] = [];

type BudgetFilter = "all" | BudgetTimeStatus | BudgetUsageStatus;

const filters: Array<{ value: BudgetFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "warning", label: "80%+" },
  { value: "exceeded", label: "100%+" },
  { value: "upcoming", label: "Akan datang" },
  { value: "expired", label: "Berakhir" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Aksi budget gagal.";
}

function showBudgetThresholdToast(budget: Budget) {
  if (budget.usageStatus === "exceeded") {
    toast.error(`Budget ${budget.category.name} melewati limit.`);
    return;
  }

  if (budget.usageStatus === "warning") {
    toast.warning(`Budget ${budget.category.name} sudah mencapai ${budget.progress.toFixed(1)}%.`);
  }
}

function matchesFilter(budget: Budget, filter: BudgetFilter) {
  if (filter === "all") {
    return true;
  }

  return budget.timeStatus === filter || budget.usageStatus === filter;
}

export function BudgetsManager() {
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "IDR";
  const [activeFilter, setActiveFilter] = useState<BudgetFilter>("all");
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const budgets = budgetsQuery.data ?? emptyBudgets;
  const categories = categoriesQuery.data ?? emptyCategories;
  const budgetCategories = useMemo(
    () => categories.filter((category) => category.type === "expense" || category.type === "both"),
    [categories],
  );
  const filteredBudgets = useMemo(
    () => budgets.filter((budget) => matchesFilter(budget, activeFilter)),
    [activeFilter, budgets],
  );
  const activeBudgets = budgets.filter((budget) => budget.timeStatus === "active");
  const totalLimit = activeBudgets.reduce((total, budget) => total + budget.limit, 0);
  const totalSpent = activeBudgets.reduce((total, budget) => total + budget.spent, 0);
  const warningCount = budgets.filter((budget) => budget.usageStatus === "warning").length;
  const exceededCount = budgets.filter((budget) => budget.usageStatus === "exceeded").length;
  const submitting = createBudget.isPending || updateBudget.isPending;

  function openCreateDialog() {
    setFormMode("create");
    setEditingBudget(null);
    setIsFormOpen(true);
  }

  function openEditDialog(budget: Budget) {
    setFormMode("edit");
    setEditingBudget(budget);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: BudgetInput) {
    if (formMode === "create") {
      const budget = await createBudget.mutateAsync(input);

      toast.success("Budget ditambahkan.");
      showBudgetThresholdToast(budget);
    } else if (editingBudget) {
      const budget = await updateBudget.mutateAsync({ id: editingBudget.id, data: input });

      toast.success("Budget diperbarui.");
      showBudgetThresholdToast(budget);
    }

    setIsFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleteError(null);

    try {
      await deleteBudget.mutateAsync(deleteTarget.id);
      toast.success("Budget dihapus.");
      setDeleteTarget(null);
    } catch (error) {
      const message = getErrorMessage(error);

      setDeleteError(message);
      toast.error(message);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Target className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Budget</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Tetapkan limit per kategori dan pantau progress pengeluaran terhadap ambang 80 dan 100 persen.
            </p>
          </div>
        </div>
        <Button type="button" onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" />
          Tambah
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Budget Aktif</p>
          <p className="mt-2 text-2xl font-semibold">{activeBudgets.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Limit Aktif</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalLimit, currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Terpakai</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {formatCurrency(totalSpent, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Alert</p>
          <p className="mt-2 text-2xl font-semibold">{warningCount + exceededCount}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                  activeFilter === filter.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => budgetsQuery.refetch()}
            disabled={budgetsQuery.isFetching}
          >
            <RefreshCw
              className={cn("size-4", budgetsQuery.isFetching ? "animate-spin" : "")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>

        {budgetsQuery.isLoading ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : budgetsQuery.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">Budget gagal dimuat.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {getErrorMessage(budgetsQuery.error)}
            </p>
            <Button type="button" variant="outline" onClick={() => budgetsQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        ) : filteredBudgets.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <Target className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Belum ada budget.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Buat budget untuk kategori pengeluaran agar progress pemakaian bisa dipantau.
            </p>
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="size-4" aria-hidden="true" />
              Tambah
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredBudgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                currency={currency}
                onEdit={openEditDialog}
                onDelete={(nextBudget) => {
                  setDeleteError(null);
                  setDeleteTarget(nextBudget);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <BudgetFormDialog
        open={isFormOpen}
        mode={formMode}
        budget={editingBudget}
        categories={budgetCategories}
        submitting={submitting || categoriesQuery.isLoading}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
      />
      <DeleteBudgetDialog
        budget={deleteTarget}
        currency={currency}
        deleting={deleteBudget.isPending}
        error={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
