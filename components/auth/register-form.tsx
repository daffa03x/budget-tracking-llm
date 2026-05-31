"use client";

import { UserPlus } from "lucide-react";
import { useActionState } from "react";

import { registerAction } from "@/lib/actions/auth.actions";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/types/auth";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-4" noValidate>
      {state.message ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-medium" htmlFor="name">
        Nama
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Nama lengkap"
          aria-invalid={Boolean(state.errors?.name)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        />
        {state.errors?.name ? (
          <span className="text-xs font-normal text-destructive">{state.errors.name[0]}</span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          aria-invalid={Boolean(state.errors?.email)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        />
        {state.errors?.email ? (
          <span className="text-xs font-normal text-destructive">{state.errors.email[0]}</span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          aria-invalid={Boolean(state.errors?.password)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        />
        {state.errors?.password ? (
          <span className="text-xs font-normal text-destructive">{state.errors.password[0]}</span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium" htmlFor="confirmPassword">
        Konfirmasi password
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Ulangi password"
          aria-invalid={Boolean(state.errors?.confirmPassword)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        />
        {state.errors?.confirmPassword ? (
          <span className="text-xs font-normal text-destructive">
            {state.errors.confirmPassword[0]}
          </span>
        ) : null}
      </label>

      <Button disabled={pending} type="submit" className="mt-2 w-full">
        <UserPlus className="size-4" aria-hidden="true" />
        {pending ? "Memproses..." : "Daftar"}
      </Button>
    </form>
  );
}
