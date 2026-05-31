"use client";

import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Transaction } from "@/hooks/useTransactions";
import { formatCurrency, formatDate } from "@/lib/utils";

type DeleteTransactionDialogProps = {
  transaction: Transaction | null;
  currency: string;
  deleting: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteTransactionDialog({
  transaction,
  currency,
  deleting,
  error,
  onClose,
  onConfirm,
}: DeleteTransactionDialogProps) {
  if (!transaction) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-transaction-dialog-title"
        className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="delete-transaction-dialog-title" className="text-lg font-semibold">
                Hapus Transaksi
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(transaction.date)} · {formatCurrency(transaction.amount, currency)}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Transaksi ini akan dihapus dari catatan keuangan Anda.
          </p>
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Hapus
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
