"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Pencil, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CategoryBadge } from "@/components/common/category-badge";
import { Button } from "@/components/ui/button";
import {
  type Category,
  type CategoryType,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/useCategories";
import type { CategoryInput } from "@/lib/validations/category.schema";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { DeleteCategoryDialog } from "@/components/categories/delete-category-dialog";
import { cn } from "@/lib/utils";

const typeLabels: Record<CategoryType, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  both: "Keduanya",
};

const filters: Array<{ value: CategoryType | "all"; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "both", label: "Keduanya" },
];

const emptyCategories: Category[] = [];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Aksi kategori gagal.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function CategoriesManager() {
  const [activeFilter, setActiveFilter] = useState<CategoryType | "all">("all");
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categoriesQuery = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const categories = categoriesQuery.data ?? emptyCategories;
  const filteredCategories = useMemo(() => {
    if (activeFilter === "all") {
      return categories;
    }

    return categories.filter((category) => category.type === activeFilter);
  }, [activeFilter, categories]);

  const defaultCount = categories.filter((category) => category.isDefault).length;
  const userCount = categories.length - defaultCount;
  const submitting = createCategory.isPending || updateCategory.isPending;

  function openCreateDialog() {
    setFormMode("create");
    setEditingCategory(null);
    setIsFormOpen(true);
  }

  function openEditDialog(category: Category) {
    setFormMode("edit");
    setEditingCategory(category);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: CategoryInput) {
    if (formMode === "create") {
      await createCategory.mutateAsync(input);
      toast.success("Kategori ditambahkan.");
    } else if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, data: input });
      toast.success("Kategori diperbarui.");
    }

    setIsFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleteError(null);

    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      toast.success("Kategori dihapus.");
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
            <Tags className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Kategori</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Kelola label pemasukan dan pengeluaran untuk transaksi.
            </p>
          </div>
        </div>
        <Button type="button" onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" />
          Tambah
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
          <p className="mt-2 text-2xl font-semibold">{categories.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Default</p>
          <p className="mt-2 text-2xl font-semibold">{defaultCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Kustom</p>
          <p className="mt-2 text-2xl font-semibold">{userCount}</p>
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
            onClick={() => categoriesQuery.refetch()}
            disabled={categoriesQuery.isFetching}
          >
            <RefreshCw
              className={cn("size-4", categoriesQuery.isFetching ? "animate-spin" : "")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>

        {categoriesQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : categoriesQuery.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">Kategori gagal dimuat.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {getErrorMessage(categoriesQuery.error)}
            </p>
            <Button type="button" variant="outline" onClick={() => categoriesQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <Tags className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Belum ada kategori.</p>
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="size-4" aria-hidden="true" />
              Tambah
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipe</th>
                  <th className="px-4 py-3 text-left font-semibold">Sumber</th>
                  <th className="px-4 py-3 text-left font-semibold">Update</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <CategoryBadge
                        name={category.name}
                        icon={category.icon}
                        color={category.color}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {typeLabels[category.type]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-1 text-xs font-medium",
                          category.isDefault
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {category.isDefault ? "Default" : "Kustom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(category.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {category.canEdit ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(category)}
                            aria-label={`Edit ${category.name}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                        {category.canDelete ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(category);
                            }}
                            aria-label={`Hapus ${category.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CategoryFormDialog
        open={isFormOpen}
        mode={formMode}
        category={editingCategory}
        submitting={submitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
      />
      <DeleteCategoryDialog
        category={deleteTarget}
        deleting={deleteCategory.isPending}
        error={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
