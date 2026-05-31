"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  CircleAlert,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { CategoryBadge } from "@/components/common/category-badge";
import { PocketBadge } from "@/components/pockets/pocket-badge";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { Button } from "@/components/ui/button";
import { DeleteTransactionDialog } from "@/components/transactions/delete-transaction-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import {
  type Transaction,
  type TransactionFilters,
  type TransactionType,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/useTransactions";
import { type Category, useCategories } from "@/hooks/useCategories";
import { type Pocket, usePockets } from "@/hooks/usePockets";
import type { TransactionInput } from "@/lib/validations/transaction.schema";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const emptyTransactions: Transaction[] = [];
const emptyCategories: Category[] = [];
const emptyPockets: Pocket[] = [];

const typeLabels: Record<TransactionType, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Aksi transaksi gagal.";
}

function typeBadgeClass(type: TransactionType) {
  return type === "income"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";
}

function normalizeFilterValue(value: string) {
  return value === "all" ? undefined : value;
}

function buildExportHref(filters: TransactionFilters) {
  const searchParams = new URLSearchParams();

  if (filters.startDate) {
    searchParams.set("startDate", filters.startDate);
  }

  if (filters.endDate) {
    searchParams.set("endDate", filters.endDate);
  }

  if (filters.categoryId) {
    searchParams.set("categoryId", filters.categoryId);
  }

  if (filters.pocketId) {
    searchParams.set("pocketId", filters.pocketId);
  }

  if (filters.type) {
    searchParams.set("type", filters.type);
  }

  if (filters.search) {
    searchParams.set("search", filters.search);
  }

  const queryString = searchParams.toString();

  return queryString ? `/api/reports/export?${queryString}` : "/api/reports/export";
}

export function TransactionsManager() {
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "IDR";
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 10,
  });
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const normalizedFilters = useMemo(
    () => ({
      ...filters,
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
    }),
    [filters],
  );

  const transactionsQuery = useTransactions(normalizedFilters);
  const categoriesQuery = useCategories();
  const pocketsQuery = usePockets();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const transactions = transactionsQuery.data?.data ?? emptyTransactions;
  const categories = categoriesQuery.data ?? emptyCategories;
  const pockets = pocketsQuery.data ?? emptyPockets;
  const pagination = transactionsQuery.data?.pagination;
  const summary = transactionsQuery.data?.summary;
  const submitting = createTransaction.isPending || updateTransaction.isPending;
  const exportHref = buildExportHref(normalizedFilters);

  function updateFilters(nextFilters: Partial<TransactionFilters>) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  function clearFilters() {
    setFilters({ page: 1, limit: filters.limit ?? 10 });
  }

  function openCreateDialog() {
    setFormMode("create");
    setEditingTransaction(null);
    setIsFormOpen(true);
  }

  function openEditDialog(transaction: Transaction) {
    setFormMode("edit");
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: TransactionInput) {
    if (formMode === "create") {
      await createTransaction.mutateAsync(input);
      toast.success("Transaksi ditambahkan.");
    } else if (editingTransaction) {
      await updateTransaction.mutateAsync({ id: editingTransaction.id, data: input });
      toast.success("Transaksi diperbarui.");
    }

    setIsFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleteError(null);

    try {
      await deleteTransaction.mutateAsync(deleteTarget.id);
      toast.success("Transaksi dihapus.");
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
            <ArrowLeftRight className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Transaksi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Catat pemasukan dan pengeluaran dengan filter tanggal, kategori, dan tipe.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <ReportExportButton
            href={exportHref}
            className="w-full border bg-background text-foreground hover:bg-muted sm:w-auto"
          />
          <Button type="button" onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            Tambah
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Pemasukan</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {formatCurrency(summary?.totalIncome ?? 0, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Pengeluaran</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {formatCurrency(summary?.totalExpense ?? 0, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Saldo Bersih</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(summary?.netBalance ?? 0, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Total Catatan</p>
          <p className="mt-2 text-2xl font-semibold">{summary?.transactionCount ?? 0}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="grid gap-3 border-b p-4 xl:grid-cols-[minmax(180px,1.2fr)_repeat(5,minmax(140px,1fr))_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.search ?? ""}
              onChange={(event) => updateFilters({ search: event.target.value || undefined })}
              placeholder="Cari deskripsi"
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
          <input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(event) => updateFilters({ startDate: event.target.value || undefined })}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Tanggal mulai"
          />
          <input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(event) => updateFilters({ endDate: event.target.value || undefined })}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Tanggal akhir"
          />
          <select
            value={filters.type ?? "all"}
            onChange={(event) =>
              updateFilters({ type: normalizeFilterValue(event.target.value) as TransactionType })
            }
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Filter tipe transaksi"
          >
            <option value="all">Semua tipe</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
          <select
            value={filters.categoryId ?? "all"}
            onChange={(event) =>
              updateFilters({ categoryId: normalizeFilterValue(event.target.value) })
            }
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Filter kategori"
          >
            <option value="all">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={filters.pocketId ?? "all"}
            onChange={(event) =>
              updateFilters({ pocketId: normalizeFilterValue(event.target.value) })
            }
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Filter kantong"
          >
            <option value="all">Semua kantong</option>
            {pockets.map((pocket) => (
              <option key={pocket.id} value={pocket.id}>
                {pocket.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clearFilters}>
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => transactionsQuery.refetch()}
              disabled={transactionsQuery.isFetching}
              aria-label="Refresh transaksi"
            >
              <RefreshCw
                className={cn("size-4", transactionsQuery.isFetching ? "animate-spin" : "")}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        {transactionsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : transactionsQuery.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">Transaksi gagal dimuat.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {getErrorMessage(transactionsQuery.error)}
            </p>
            <Button type="button" variant="outline" onClick={() => transactionsQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <ArrowLeftRight className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Belum ada transaksi.</p>
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="size-4" aria-hidden="true" />
              Tambah
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Deskripsi</th>
                  <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-left font-semibold">Kantong</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipe</th>
                  <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((transaction) => {
                  const TypeIcon =
                    transaction.type === "income" ? ArrowUpCircle : ArrowDownCircle;

                  return (
                    <tr key={transaction.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <p className="truncate font-medium">
                          {transaction.description || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {transaction.category ? (
                          <CategoryBadge
                            name={transaction.category.name}
                            icon={transaction.category.icon}
                            color={transaction.category.color}
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.pocket ? (
                          <PocketBadge
                            name={transaction.pocket.name}
                            icon={transaction.pocket.icon}
                            color={transaction.pocket.color}
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                            typeBadgeClass(transaction.type),
                          )}
                        >
                          <TypeIcon className="size-3.5" aria-hidden="true" />
                          {typeLabels[transaction.type]}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-right font-semibold",
                          transaction.type === "income" ? "text-emerald-700" : "text-rose-700",
                        )}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(transaction)}
                            aria-label={`Edit transaksi ${transaction.id}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(transaction);
                            }}
                            aria-label={`Hapus transaksi ${transaction.id}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {pagination?.page ?? 1} dari {pagination?.totalPages ?? 1}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!pagination || pagination.page <= 1}
              onClick={() => updateFilters({ page: Math.max(1, (pagination?.page ?? 1) - 1) })}
            >
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!pagination || pagination.page >= pagination.totalPages}
              onClick={() =>
                updateFilters({ page: Math.min(pagination?.totalPages ?? 1, (pagination?.page ?? 1) + 1) })
              }
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      <TransactionFormDialog
        open={isFormOpen}
        mode={formMode}
        transaction={editingTransaction}
        categories={categories}
        pockets={pockets}
        submitting={submitting || pocketsQuery.isLoading}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
      />
      <DeleteTransactionDialog
        transaction={deleteTarget}
        currency={currency}
        deleting={deleteTransaction.isPending}
        error={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
