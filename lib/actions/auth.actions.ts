"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { DuplicateEmailError, registerUser } from "@/lib/services/user.service";
import { loginSchema, registerSchema } from "@/lib/validations/auth.schema";
import type { AuthActionState } from "@/types/auth";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsedCredentials = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsedCredentials.success) {
    return {
      errors: parsedCredentials.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      email: parsedCredentials.data.email,
      password: parsedCredentials.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        message: "Email atau password tidak valid.",
      };
    }

    throw error;
  }

  return {};
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsedRegistration = registerSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });

  if (!parsedRegistration.success) {
    return {
      errors: parsedRegistration.error.flatten().fieldErrors,
    };
  }

  try {
    await registerUser(parsedRegistration.data);
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return {
        errors: {
          email: ["Email sudah terdaftar."],
        },
      };
    }

    return {
      message: "Akun gagal dibuat. Coba lagi nanti.",
    };
  }

  redirect("/login");
}
