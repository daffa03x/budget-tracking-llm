"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ArrowDownCircle, ArrowUpCircle, Loader2, X } from "lucide-react";

import { CurrencyInput } from "@/components/common/currency-input";
import { Button } from "@/components/ui/button";
import type { Category } from "@/hooks/useCategories";
import type { Pocket } from "@/hooks/usePockets";
import type { Transaction } from "@/hooks/useTransactions";
import {
  transactionSchema,
  type TransactionInput,
} from "@/lib/validations/transaction.schema";

type TransactionFormValues = {
  amount: number;
  type: "income" | "expense";
  description: string;
  date: string;
  categoryId: string;
  pocketId: string;
};

type TransactionFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  transaction?: Transaction | null;
  categories: Category[];
  pockets: Pocket[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Transaksi gagal disimpan.";
}

const defaultValues: TransactionFormValues = {
  amount: 0,
  type: "expense",
  description: "",
  date: todayInputValue(),
  categoryId: "",
  pocketId: "",
};

export function TransactionFormDialog({
  open,
  mode,
  transaction,
  categories,
  pockets,
  submitting,
  onClose,
  onSubmit,
}: TransactionFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    defaultValues,
  });
  const selectedType = useWatch({ control, name: "type" });
  const selectedCategoryId = useWatch({ control, name: "categoryId" });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      transaction
        ? {
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description ?? "",
            date: dateInputValue(transaction.date),
            categoryId: transaction.categoryId ?? "",
            pocketId: transaction.pocketId ?? "",
          }
        : defaultValues,
    );
  }, [open, reset, transaction]);

  const compatibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === selectedType || category.type === "both",
      ),
    [categories, selectedType],
  );

  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }

    const categoryStillValid = compatibleCategories.some(
      (category) => category.id === selectedCategoryId,
    );

    if (!categoryStillValid) {
      setValue("categoryId", "");
    }
  }, [compatibleCategories, selectedCategoryId, setValue]);

  if (!open) {
    return null;
  }

  const submitForm = handleSubmit(async (values) => {
    const parsedValues = transactionSchema.safeParse({
      ...values,
      categoryId: values.categoryId || null,
      pocketId: values.pocketId || null,
    });

    if (!parsedValues.success) {
      const fieldErrors = parsedValues.error.flatten().fieldErrors;

      (Object.keys(fieldErrors) as Array<keyof TransactionFormValues>).forEach((field) => {
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

  const title = mode === "create" ? "Tambah Transaksi" : "Edit Transaksi";
  const TypeIcon = selectedType === "income" ? ArrowUpCircle : ArrowDownCircle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-dialog-title"
        className="w-full max-w-xl rounded-lg border bg-card text-card-foreground shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <TypeIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="transaction-dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground">
                Catat pemasukan atau pengeluaran dengan kategori dan kantong opsional.
              </p>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="transaction-type" className="text-sm font-medium">
                Tipe
              </label>
              <select
                id="transaction-type"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.type)}
                {...register("type")}
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
              {errors.type?.message ? (
                <p className="text-xs text-destructive">{errors.type.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="transaction-date" className="text-sm font-medium">
                Tanggal
              </label>
              <input
                id="transaction-date"
                type="date"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.date)}
                {...register("date")}
              />
              {errors.date?.message ? (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="transaction-amount" className="text-sm font-medium">
              Jumlah
            </label>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <CurrencyInput
                  id="transaction-amount"
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                  aria-invalid={Boolean(errors.amount)}
                />
              )}
            />
            {errors.amount?.message ? (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="transaction-category" className="text-sm font-medium">
                Kategori
              </label>
              <select
                id="transaction-category"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.categoryId)}
                {...register("categoryId")}
              >
                <option value="">Tanpa kategori</option>
                {compatibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId?.message ? (
                <p className="text-xs text-destructive">{errors.categoryId.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="transaction-pocket" className="text-sm font-medium">
                Kantong
              </label>
              <select
                id="transaction-pocket"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-invalid={Boolean(errors.pocketId)}
                {...register("pocketId")}
              >
                <option value="">Tanpa kantong</option>
                {pockets.map((pocket) => (
                  <option key={pocket.id} value={pocket.id}>
                    {pocket.name}
                  </option>
                ))}
              </select>
              {errors.pocketId?.message ? (
                <p className="text-xs text-destructive">{errors.pocketId.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="transaction-description" className="text-sm font-medium">
              Deskripsi
            </label>
            <textarea
              id="transaction-description"
              rows={3}
              maxLength={255}
              className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description?.message ? (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
