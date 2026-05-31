"use client";

import { Loader2, Trash2, X } from "lucide-react";

import { CategoryBadge } from "@/components/common/category-badge";
import { Button } from "@/components/ui/button";
import type { Category } from "@/hooks/useCategories";

type DeleteCategoryDialogProps = {
  category: Category | null;
  deleting: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteCategoryDialog({
  category,
  deleting,
  error,
  onClose,
  onConfirm,
}: DeleteCategoryDialogProps) {
  if (!category) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-category-dialog-title"
        className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="delete-category-dialog-title" className="text-lg font-semibold">
                Hapus Kategori
              </h2>
              <div className="mt-3">
                <CategoryBadge name={category.name} icon={category.icon} color={category.color} />
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Kategori ini akan dihapus dari akun Anda.
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
