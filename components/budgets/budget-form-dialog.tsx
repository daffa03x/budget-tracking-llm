"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Loader2, Target, X } from "lucide-react";

import { CategoryBadge } from "@/components/common/category-badge";
import { CurrencyInput } from "@/components/common/currency-input";
import { Button } from "@/components/ui/button";
import type { Category } from "@/hooks/useCategories";
import type { Budget, BudgetPeriod } from "@/hooks/useBudgets";
import { budgetSchema, type BudgetInput } from "@/lib/validations/budget.schema";

type BudgetFormValues = {
  limit: number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  categoryId: string;
};

type BudgetFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  budget?: Budget | null;
  categories: Category[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: BudgetInput) => Promise<void>;
};

function dateInputValue(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthStartInputValue() {
  const now = new Date();

  return dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function monthEndInputValue() {
  const now = new Date();

  return dateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Budget gagal disimpan.";
}

const defaultValues: BudgetFormValues = {
  limit: 0,
  period: "monthly",
  startDate: monthStartInputValue(),
  endDate: monthEndInputValue(),
  categoryId: "",
};

export function BudgetFormDialog({
  open,
  mode,
  budget,
  categories,
  submitting,
  onClose,
  onSubmit,
}: BudgetFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    defaultValues,
  });
  const selectedCategoryId = useWatch({ control, name: "categoryId" });
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      budget
        ? {
            limit: budget.limit,
            period: budget.period,
            startDate: dateInputValue(budget.startDate),
            endDate: dateInputValue(budget.endDate),
            categoryId: budget.categoryId,
          }
        : defaultValues,
    );
  }, [budget, open, reset]);

  if (!open) {
    return null;
  }

  const title = mode === "create" ? "Tambah Budget" : "Edit Budget";

  const submitForm = handleSubmit(async (values) => {
    const parsedValues = budgetSchema.safeParse(values);

    if (!parsedValues.success) {
      const fieldErrors = parsedValues.error.flatten().fieldErrors;

      (Object.keys(fieldErrors) as Array<keyof BudgetFormValues>).forEach((field) => {
        const message = fieldErrors[field]?.[0];

        if (message) {
          setError(field, { message });
        }
      });

      return;
    }

    try {
      await onSubmit(parsedValues.data);
    } catch (error) {
      setError("root", { message: getErrorMessage(error) });
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-dialog-title"
        className="w-full max-w-xl rounded-lg border bg-card text-card-foreground shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Target className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="budget-dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              <div className="mt-2">
                {selectedCategory ? (
                  <CategoryBadge
                    name={selectedCategory.name}
                    icon={selectedCategory.icon}
                    color={selectedCategory.color}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Pilih kategori pengeluaran.</p>
                )}
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={submitForm} className="space-y-4 p-4">
          {errors.root?.message ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          ) : null}

          {categories.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Buat kategori pengeluaran lebih dulu sebelum menambahkan budget.
            </p>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="budget-category" className="text-sm font-medium">
              Kategori
            </label>
            <select
              id="budget-category"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-invalid={Boolean(errors.categoryId)}
              {...register("categoryId")}
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId?.message ? (
              <p className="text-xs text-destructive">{errors.categoryId.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="budget-period" className="text-sm font-medium">
                Periode
              </label>
              <select
                id="budget-period"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.period)}
                {...register("period")}
              >
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
              {errors.period?.message ? (
                <p className="text-xs text-destructive">{errors.period.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="budget-limit" className="text-sm font-medium">
                Limit
              </label>
              <Controller
                control={control}
                name="limit"
                render={({ field }) => (
                  <CurrencyInput
                    id="budget-limit"
                    value={field.value}
                    onBlur={field.onBlur}
                    onValueChange={field.onChange}
                    aria-invalid={Boolean(errors.limit)}
                  />
                )}
              />
              {errors.limit?.message ? (
                <p className="text-xs text-destructive">{errors.limit.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="budget-start-date" className="text-sm font-medium">
                Mulai
              </label>
              <input
                id="budget-start-date"
                type="date"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.startDate)}
                {...register("startDate")}
              />
              {errors.startDate?.message ? (
                <p className="text-xs text-destructive">{errors.startDate.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="budget-end-date" className="text-sm font-medium">
                Selesai
              </label>
              <input
                id="budget-end-date"
                type="date"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.endDate)}
                {...register("endDate")}
              />
              {errors.endDate?.message ? (
                <p className="text-xs text-destructive">{errors.endDate.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting || categories.length === 0}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
