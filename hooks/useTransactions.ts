"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  TransactionInput,
  TransactionUpdateInput,
} from "@/lib/validations/transaction.schema";

export type TransactionType = "income" | "expense";

export type TransactionCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: "income" | "expense" | "both";
  isDefault: boolean;
};

export type TransactionPocket = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type Transaction = {
  id: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  categoryId: string | null;
  pocketId: string | null;
  category: TransactionCategory | null;
  pocket: TransactionPocket | null;
};

export type TransactionFilters = {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  pocketId?: string;
  type?: TransactionType;
  search?: string;
  page?: number;
  limit?: number;
};

export type TransactionsResponse = {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    transactionCount: number;
  };
};

type ApiResponse<T> = {
  data: T;
};

type ApiErrorResponse = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
};

class ApiRequestError extends Error {
  fields?: Record<string, string[] | undefined>;

  constructor(message: string, fields?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "ApiRequestError";
    this.fields = fields;
  }
}

const transactionsQueryKey = ["transactions"] as const;

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiErrorResponse | unknown;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;

    throw new ApiRequestError(
      errorPayload?.error ?? "Permintaan transaksi gagal.",
      errorPayload?.fields,
    );
  }

  return payload;
}

function buildSearchParams(filters: TransactionFilters) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  return searchParams;
}

async function fetchTransactions(filters: TransactionFilters) {
  const searchParams = buildSearchParams(filters);
  const response = await fetch(`/api/transactions?${searchParams.toString()}`, {
    credentials: "same-origin",
  });

  return (await parseResponse(response)) as TransactionsResponse;
}

async function createTransaction(input: TransactionInput) {
  const response = await fetch("/api/transactions", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return ((await parseResponse(response)) as ApiResponse<Transaction>).data;
}

async function updateTransaction(input: { id: string; data: TransactionUpdateInput }) {
  const response = await fetch(`/api/transactions/${input.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.data),
  });

  return ((await parseResponse(response)) as ApiResponse<Transaction>).data;
}

async function deleteTransaction(id: string) {
  const response = await fetch(`/api/transactions/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  return ((await parseResponse(response)) as ApiResponse<{ id: string }>).data;
}

function invalidateFinancialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
  queryClient.invalidateQueries({ queryKey: ["pockets"] });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
  queryClient.invalidateQueries({ queryKey: ["budgets"] });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: [...transactionsQueryKey, filters],
    queryFn: () => fetchTransactions(filters),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => invalidateFinancialQueries(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => invalidateFinancialQueries(queryClient),
  });
}
