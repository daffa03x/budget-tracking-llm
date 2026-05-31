import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <Link href="/" className="text-sm font-semibold">
          Budget Tracking
        </Link>
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Register</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Buat akun baru</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Buat akun pribadi untuk menyimpan transaksi, budget, dan preferensi mata uang.
          </p>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </p>
      </section>
    </main>
  );
}
