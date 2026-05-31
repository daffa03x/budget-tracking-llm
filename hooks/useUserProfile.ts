"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeleteUserAccountInput,
  DeleteUserTransactionsInput,
  UserPasswordUpdateInput,
  UserProfileUpdateInput,
} from "@/lib/validations/user.schema";

export type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  currency: string;
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

export class ApiRequestError extends Error {
  fields?: Record<string, string[] | undefined>;

  constructor(message: string, fields?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "ApiRequestError";
    this.fields = fields;
  }
}

const userProfileQueryKey = ["user-profile"] as const;
const financialQueryKeys = [
  ["transactions"],
  ["reports"],
  ["budgets"],
  ["categories"],
  ["pockets"],
] as const;

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | ApiErrorResponse | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;

    throw new ApiRequestError(
      errorPayload?.error ?? "Permintaan settings gagal.",
      errorPayload?.fields,
    );
  }

  return (payload as ApiResponse<T>).data;
}

async function fetchUserProfile() {
  const response = await fetch("/api/user/profile", {
    credentials: "same-origin",
  });

  return readJson<UserProfile>(response);
}

async function updateUserProfile(input: UserProfileUpdateInput) {
  const response = await fetch("/api/user/profile", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<UserProfile>(response);
}

async function updateUserPassword(input: UserPasswordUpdateInput) {
  const response = await fetch("/api/user/password", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<{ id: string }>(response);
}

async function deleteUserTransactions(input: DeleteUserTransactionsInput) {
  const response = await fetch("/api/user/transactions", {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<{ transactionCount: number; budgetCount: number }>(response);
}

async function deleteUserAccount(input: DeleteUserAccountInput) {
  const response = await fetch("/api/user", {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<{ id: string }>(response);
}

export function useUserProfile(initialProfile: UserProfile) {
  return useQuery({
    queryKey: userProfileQueryKey,
    queryFn: fetchUserProfile,
    initialData: initialProfile,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(userProfileQueryKey, profile);
      financialQueryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });
}

export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: updateUserPassword,
  });
}

export function useDeleteUserTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUserTransactions,
    onSuccess: () => {
      financialQueryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });
}

export function useDeleteUserAccount() {
  return useMutation({
    mutationFn: deleteUserAccount,
  });
}
