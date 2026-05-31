"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BudgetInput, BudgetUpdateInput } from "@/lib/validations/budget.schema";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";
export type BudgetUsageStatus = "safe" | "warning" | "exceeded";
export type BudgetTimeStatus = "upcoming" | "active" | "expired";

export type BudgetCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: "income" | "expense" | "both";
  isDefault: boolean;
};

export type Budget = {
  id: string;
  limit: number;
  spent: number;
  remaining: number;
  progress: number;
  usageStatus: BudgetUsageStatus;
  timeStatus: BudgetTimeStatus;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  categoryId: string;
  category: BudgetCategory;
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

const budgetsQueryKey = ["budgets"] as const;

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | ApiErrorResponse | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;

    throw new ApiRequestError(
      errorPayload?.error ?? "Permintaan budget gagal.",
      errorPayload?.fields,
    );
  }

  return (payload as ApiResponse<T>).data;
}

async function fetchBudgets() {
  const response = await fetch("/api/budgets", {
    credentials: "same-origin",
  });

  return readJson<Budget[]>(response);
}

async function createBudget(input: BudgetInput) {
  const response = await fetch("/api/budgets", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<Budget>(response);
}

async function updateBudget(input: { id: string; data: BudgetUpdateInput }) {
  const response = await fetch(`/api/budgets/${input.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.data),
  });

  return readJson<Budget>(response);
}

async function deleteBudget(id: string) {
  const response = await fetch(`/api/budgets/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  return readJson<{ id: string }>(response);
}

function invalidateBudgetQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: budgetsQueryKey });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
}

export function useBudgets() {
  return useQuery({
    queryKey: budgetsQueryKey,
    queryFn: fetchBudgets,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBudget,
    onSuccess: () => invalidateBudgetQueries(queryClient),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBudget,
    onSuccess: () => invalidateBudgetQueries(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => invalidateBudgetQueries(queryClient),
  });
}
