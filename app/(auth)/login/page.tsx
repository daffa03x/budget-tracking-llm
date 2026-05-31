import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <Link href="/" className="text-sm font-semibold">
          Budget Tracking
        </Link>
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Login</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Masuk ke akun</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Gunakan email dan password yang sudah terdaftar untuk membuka dashboard.
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Daftar
          </Link>
        </p>
      </section>
    </main>
  );
}
