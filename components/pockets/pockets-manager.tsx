"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CircleAlert,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { DeletePocketDialog } from "@/components/pockets/delete-pocket-dialog";
import { PocketBadge } from "@/components/pockets/pocket-badge";
import { PocketFormDialog } from "@/components/pockets/pocket-form-dialog";
import { Button } from "@/components/ui/button";
import {
  type Pocket,
  useCreatePocket,
  useDeletePocket,
  usePockets,
  useUpdatePocket,
} from "@/hooks/usePockets";
import type { PocketInput } from "@/lib/validations/pocket.schema";
import { cn, formatCurrency } from "@/lib/utils";

const emptyPockets: Pocket[] = [];

type PocketFilter = "all" | "with-transactions" | "empty" | "negative";

const filters: Array<{ value: PocketFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "with-transactions", label: "Ada transaksi" },
  { value: "empty", label: "Kosong" },
  { value: "negative", label: "Minus" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Aksi kantong gagal.";
}

function matchesFilter(pocket: Pocket, filter: PocketFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "with-transactions") {
    return pocket.transactionCount > 0;
  }

  if (filter === "empty") {
    return pocket.transactionCount === 0;
  }

  return pocket.currentBalance < 0;
}

export function PocketsManager() {
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "IDR";
  const [activeFilter, setActiveFilter] = useState<PocketFilter>("all");
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pocket | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const pocketsQuery = usePockets();
  const createPocket = useCreatePocket();
  const updatePocket = useUpdatePocket();
  const deletePocket = useDeletePocket();

  const pockets = pocketsQuery.data ?? emptyPockets;
  const filteredPockets = useMemo(
    () => pockets.filter((pocket) => matchesFilter(pocket, activeFilter)),
    [activeFilter, pockets],
  );
  const totalInitialBalance = pockets.reduce((total, pocket) => total + pocket.initialBalance, 0);
  const totalIncome = pockets.reduce((total, pocket) => total + pocket.income, 0);
  const totalExpense = pockets.reduce((total, pocket) => total + pocket.expense, 0);
  const totalCurrentBalance = pockets.reduce((total, pocket) => total + pocket.currentBalance, 0);
  const totalTransactionCount = pockets.reduce(
    (total, pocket) => total + pocket.transactionCount,
    0,
  );
  const submitting = createPocket.isPending || updatePocket.isPending;

  function openCreateDialog() {
    setFormMode("create");
    setEditingPocket(null);
    setIsFormOpen(true);
  }

  function openEditDialog(pocket: Pocket) {
    setFormMode("edit");
    setEditingPocket(pocket);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: PocketInput) {
    if (formMode === "create") {
      await createPocket.mutateAsync(input);
      toast.success("Kantong ditambahkan.");
    } else if (editingPocket) {
      await updatePocket.mutateAsync({ id: editingPocket.id, data: input });
      toast.success("Kantong diperbarui.");
    }

    setIsFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleteError(null);

    try {
      await deletePocket.mutateAsync(deleteTarget.id);
      toast.success("Kantong dihapus.");
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
            <WalletCards className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Transaksi</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Kantong</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Kelola sumber dana seperti kas, rekening bank, e-wallet, atau tabungan yang dipakai transaksi.
            </p>
          </div>
        </div>
        <Button type="button" onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" />
          Tambah
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Total Kantong</p>
          <p className="mt-2 text-2xl font-semibold">{pockets.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Saldo Awal</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(totalInitialBalance, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Pemasukan</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {formatCurrency(totalIncome, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Pengeluaran</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {formatCurrency(totalExpense, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Saldo Saat Ini</p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold",
              totalCurrentBalance < 0 ? "text-rose-700" : "text-emerald-700",
            )}
          >
            {formatCurrency(totalCurrentBalance, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Transaksi</p>
          <p className="mt-2 text-2xl font-semibold">{totalTransactionCount}</p>
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
            onClick={() => pocketsQuery.refetch()}
            disabled={pocketsQuery.isFetching}
          >
            <RefreshCw
              className={cn("size-4", pocketsQuery.isFetching ? "animate-spin" : "")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>

        {pocketsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : pocketsQuery.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">Kantong gagal dimuat.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {getErrorMessage(pocketsQuery.error)}
            </p>
            <Button type="button" variant="outline" onClick={() => pocketsQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Coba lagi
            </Button>
          </div>
        ) : filteredPockets.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <WalletCards className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Belum ada kantong.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Buat kantong untuk memisahkan saldo kas, rekening, e-wallet, atau tabungan.
            </p>
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="size-4" aria-hidden="true" />
              Tambah
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Kantong</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo Awal</th>
                  <th className="px-4 py-3 text-right font-semibold">Pemasukan</th>
                  <th className="px-4 py-3 text-right font-semibold">Pengeluaran</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo Saat Ini</th>
                  <th className="px-4 py-3 text-right font-semibold">Transaksi</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPockets.map((pocket) => (
                  <tr key={pocket.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <PocketBadge name={pocket.name} icon={pocket.icon} color={pocket.color} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {formatCurrency(pocket.initialBalance, currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-emerald-700">
                      <span className="inline-flex items-center justify-end gap-1">
                        <ArrowUpCircle className="size-3.5" aria-hidden="true" />
                        {formatCurrency(pocket.income, currency)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-rose-700">
                      <span className="inline-flex items-center justify-end gap-1">
                        <ArrowDownCircle className="size-3.5" aria-hidden="true" />
                        {formatCurrency(pocket.expense, currency)}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-right font-semibold",
                        pocket.currentBalance < 0 ? "text-rose-700" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(pocket.currentBalance, currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                      {pocket.transactionCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => openEditDialog(pocket)}
                          aria-label={`Edit ${pocket.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(pocket);
                          }}
                          aria-label={`Hapus ${pocket.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PocketFormDialog
        open={isFormOpen}
        mode={formMode}
        pocket={editingPocket}
        submitting={submitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
      />
      <DeletePocketDialog
        pocket={deleteTarget}
        deleting={deletePocket.isPending}
        error={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
