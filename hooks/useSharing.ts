"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  SharingActionInput,
  SharingInviteInput,
} from "@/lib/validations/sharing.schema";

export type SharingUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type SharingConnection = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  direction: "incoming" | "outgoing";
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  requester: SharingUser;
  recipient: SharingUser;
  partner: SharingUser;
};

export type SharingOverview = {
  scopeUserIds: string[];
  connections: SharingConnection[];
  incomingInvitations: SharingConnection[];
  outgoingInvitations: SharingConnection[];
};

type ApiResponse<T> = {
  data: T;
};

type ApiErrorResponse = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
};

export class SharingApiError extends Error {
  fields?: Record<string, string[] | undefined>;

  constructor(message: string, fields?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "SharingApiError";
    this.fields = fields;
  }
}

const sharingQueryKey = ["sharing"] as const;
const financialQueryKeys = [
  ["transactions"],
  ["reports"],
  ["budgets"],
  ["categories"],
  ["pockets"],
] as const;

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;

    throw new SharingApiError(
      errorPayload?.error ?? "Permintaan sharing gagal.",
      errorPayload?.fields,
    );
  }

  return (payload as ApiResponse<T>).data;
}

async function fetchSharingOverview() {
  const response = await fetch("/api/sharing", {
    credentials: "same-origin",
  });

  return readJson<SharingOverview>(response);
}

async function createSharingInvitation(input: SharingInviteInput) {
  const response = await fetch("/api/sharing", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readJson<SharingConnection>(response);
}

async function updateSharingInvitation(input: { id: string; data: SharingActionInput }) {
  const response = await fetch(`/api/sharing/${input.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.data),
  });

  return readJson<SharingConnection>(response);
}

async function deleteSharingConnection(id: string) {
  const response = await fetch(`/api/sharing/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  return readJson<{ id: string }>(response);
}

function invalidateSharingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: sharingQueryKey });
  financialQueryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}

export function useSharing(initialSharing?: SharingOverview) {
  return useQuery({
    queryKey: sharingQueryKey,
    queryFn: fetchSharingOverview,
    initialData: initialSharing,
  });
}

export function useCreateSharingInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSharingInvitation,
    onSuccess: () => invalidateSharingQueries(queryClient),
  });
}

export function useUpdateSharingInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSharingInvitation,
    onSuccess: () => invalidateSharingQueries(queryClient),
  });
}

export function useDeleteSharingConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSharingConnection,
    onSuccess: () => invalidateSharingQueries(queryClient),
  });
}
