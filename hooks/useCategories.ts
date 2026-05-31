"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CategoryInput, CategoryUpdateInput } from "@/lib/validations/category.schema";

export type CategoryType = "income" | "expense" | "both";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  isDefault: boolean;
  canEdit: boolean;
  canDelete: boolean;
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

const categoryQueryKey = ["categories"] as const;

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | ApiErrorResponse | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;

    throw new ApiRequestError(
      errorPayload?.error ?? "Permintaan kategori gagal.",
      errorPayload?.fields,
    );
  }

  return (payload as ApiResponse<T>).data;
}

async function fetchCategories() {
  const response = await fetch("/api/categories", {
    credentials: "same-origin",
  });

  return readJson<Category[]>(response);
}

async function createCategory(input: CategoryInput) {
  const response = await fetch("/api/categories", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<Category>(response);
}

async function updateCategory(input: { id: string; data: CategoryUpdateInput }) {
  const response = await fetch(`/api/categories/${input.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.data),
  });

  return readJson<Category>(response);
}

async function deleteCategory(id: string) {
  const response = await fetch(`/api/categories/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  return readJson<{ id: string }>(response);
}

export function useCategories() {
  return useQuery({
    queryKey: categoryQueryKey,
    queryFn: fetchCategories,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryQueryKey }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryQueryKey }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryQueryKey }),
  });
}
