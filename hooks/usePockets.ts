"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PocketInput, PocketUpdateInput } from "@/lib/validations/pocket.schema";

export type Pocket = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  initialBalance: number;
  income: number;
  expense: number;
  currentBalance: number;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
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

const pocketsQueryKey = ["pockets"] as const;

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | ApiErrorResponse | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;

    throw new ApiRequestError(
      errorPayload?.error ?? "Permintaan kantong gagal.",
      errorPayload?.fields,
    );
  }

  return (payload as ApiResponse<T>).data;
}

async function fetchPockets() {
  const response = await fetch("/api/pockets", {
    credentials: "same-origin",
  });

  return readJson<Pocket[]>(response);
}

async function createPocket(input: PocketInput) {
  const response = await fetch("/api/pockets", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<Pocket>(response);
}

async function updatePocket(input: { id: string; data: PocketUpdateInput }) {
  const response = await fetch(`/api/pockets/${input.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.data),
  });

  return readJson<Pocket>(response);
}

async function deletePocket(id: string) {
  const response = await fetch(`/api/pockets/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  return readJson<{ id: string }>(response);
}

function invalidatePocketQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: pocketsQueryKey });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

export function usePockets() {
  return useQuery({
    queryKey: pocketsQueryKey,
    queryFn: fetchPockets,
  });
}

export function useCreatePocket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPocket,
    onSuccess: () => invalidatePocketQueries(queryClient),
  });
}

export function useUpdatePocket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePocket,
    onSuccess: () => invalidatePocketQueries(queryClient),
  });
}

export function useDeletePocket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePocket,
    onSuccess: () => invalidatePocketQueries(queryClient),
  });
}
