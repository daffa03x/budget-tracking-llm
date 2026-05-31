import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Email tidak valid.")
  .max(254, "Email terlalu panjang.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(72, "Password maksimal 72 karakter.")
  .regex(/[A-Za-z]/, "Password harus memuat huruf.")
  .regex(/[0-9]/, "Password harus memuat angka.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password wajib diisi."),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter.")
      .max(80, "Nama maksimal 80 karakter."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
