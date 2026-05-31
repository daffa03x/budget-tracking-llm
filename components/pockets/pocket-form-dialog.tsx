"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Loader2, X } from "lucide-react";

import { CurrencyInput } from "@/components/common/currency-input";
import { PocketBadge, pocketIconOptions } from "@/components/pockets/pocket-badge";
import { Button } from "@/components/ui/button";
import type { Pocket } from "@/hooks/usePockets";
import { pocketSchema, type PocketInput } from "@/lib/validations/pocket.schema";

type PocketFormValues = {
  name: string;
  icon: string;
  color: string;
  initialBalance: number;
};

type PocketFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  pocket?: Pocket | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: PocketInput) => Promise<void>;
};

const defaultValues: PocketFormValues = {
  name: "",
  icon: "Wallet",
  color: "#2563EB",
  initialBalance: 0,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Kantong gagal disimpan.";
}

export function PocketFormDialog({
  open,
  mode,
  pocket,
  submitting,
  onClose,
  onSubmit,
}: PocketFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<PocketFormValues>({
    defaultValues,
  });
  const watchedValues = useWatch({ control });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      pocket
        ? {
            name: pocket.name,
            icon: pocket.icon ?? "Wallet",
            color: pocket.color ?? "#2563EB",
            initialBalance: pocket.initialBalance,
          }
        : defaultValues,
    );
  }, [open, pocket, reset]);

  if (!open) {
    return null;
  }

  const title = mode === "create" ? "Tambah Kantong" : "Edit Kantong";

  const submitForm = handleSubmit(async (values) => {
    const parsedValues = pocketSchema.safeParse(values);

    if (!parsedValues.success) {
      const fieldErrors = parsedValues.error.flatten().fieldErrors;

      (Object.keys(fieldErrors) as Array<keyof PocketFormValues>).forEach((field) => {
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
        aria-labelledby="pocket-dialog-title"
        className="w-full max-w-lg rounded-lg border bg-card text-card-foreground shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div>
            <h2 id="pocket-dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            <div className="mt-3">
              <PocketBadge
                name={watchedValues.name || "Kantong"}
                icon={watchedValues.icon}
                color={watchedValues.color}
              />
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

          <div className="space-y-2">
            <label htmlFor="pocket-name" className="text-sm font-medium">
              Nama
            </label>
            <input
              id="pocket-name"
              type="text"
              maxLength={50}
              aria-invalid={Boolean(errors.name)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              {...register("name")}
            />
            {errors.name?.message ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="pocket-icon" className="text-sm font-medium">
                Ikon
              </label>
              <select
                id="pocket-icon"
                aria-invalid={Boolean(errors.icon)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                {...register("icon")}
              >
                {pocketIconOptions.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              {errors.icon?.message ? (
                <p className="text-xs text-destructive">{errors.icon.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="pocket-color" className="text-sm font-medium">
                Warna
              </label>
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <div className="flex gap-2">
                    <input
                      id="pocket-color"
                      type="color"
                      value={field.value || "#2563EB"}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      className="h-10 w-12 shrink-0 rounded-md border bg-background p-1"
                      aria-label="Pilih warna kantong"
                    />
                    <input
                      type="text"
                      name={field.name}
                      ref={field.ref}
                      value={field.value || ""}
                      onBlur={field.onBlur}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      maxLength={7}
                      aria-invalid={Boolean(errors.color)}
                      className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm font-mono outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    />
                  </div>
                )}
              />
              {errors.color?.message ? (
                <p className="text-xs text-destructive">{errors.color.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="pocket-initial-balance" className="text-sm font-medium">
              Saldo Awal
            </label>
            <Controller
              control={control}
              name="initialBalance"
              render={({ field }) => (
                <CurrencyInput
                  id="pocket-initial-balance"
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                  aria-invalid={Boolean(errors.initialBalance)}
                />
              )}
            />
            {errors.initialBalance?.message ? (
              <p className="text-xs text-destructive">{errors.initialBalance.message}</p>
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
