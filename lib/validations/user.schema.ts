import { z } from "zod";

const nullableImageSchema = z
  .string()
  .trim()
  .max(2048, "URL avatar terlalu panjang.")
  .optional()
  .refine(
    (value) => value === undefined || value === "" || z.string().url().safeParse(value).success,
    "URL avatar tidak valid.",
  )
  .transform((value) => (value === "" ? null : value));

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const emailSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .email("Email tidak valid.")
    .max(254, "Email terlalu panjang.")
    .transform((value) => value.toLowerCase())
    .optional(),
);

const currentPasswordSchema = z.preprocess(
  emptyToUndefined,
  z.string().min(1, "Password saat ini wajib diisi.").max(72, "Password terlalu panjang.").optional(),
);

const newPasswordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(72, "Password maksimal 72 karakter.")
  .regex(/[A-Za-z]/, "Password harus memuat huruf.")
  .regex(/[0-9]/, "Password harus memuat angka.");

export const userProfileUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter.")
      .max(80, "Nama maksimal 80 karakter.")
      .optional(),
    image: nullableImageSchema.optional(),
    email: emailSchema,
    confirmEmail: emailSchema,
    currentPassword: currentPasswordSchema,
    currency: z
      .string()
      .trim()
      .length(3, "Kode mata uang harus 3 huruf.")
      .regex(/^[A-Za-z]{3}$/, "Kode mata uang hanya boleh memuat huruf.")
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .superRefine((data, context) => {
    const hasProfileUpdate =
      data.name !== undefined ||
      data.image !== undefined ||
      data.email !== undefined ||
      data.currency !== undefined;

    if (!hasProfileUpdate) {
      context.addIssue({
        code: "custom",
        message: "Tidak ada data profil yang dikirim.",
      });
    }

    if (data.email && data.confirmEmail !== data.email) {
      context.addIssue({
        code: "custom",
        path: ["confirmEmail"],
        message: "Konfirmasi email tidak sama.",
      });
    }

    if (data.email && !data.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Password saat ini wajib diisi untuk mengganti email.",
      });
    }
  });

export const userPasswordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi.").max(72),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .superRefine((data, context) => {
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak sama.",
      });
    }

    if (data.currentPassword === data.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Password baru harus berbeda dari password saat ini.",
      });
    }
  });

export const deleteUserTransactionsSchema = z.object({
  confirmation: z.string().refine((value): boolean => value === "HAPUS TRANSAKSI", {
    message: "Ketik HAPUS TRANSAKSI untuk konfirmasi.",
  }),
});

export const deleteUserAccountSchema = z.object({
  password: z.string().min(1, "Password wajib diisi.").max(72, "Password terlalu panjang."),
  confirmation: z.string().refine((value): boolean => value === "HAPUS AKUN", {
    message: "Ketik HAPUS AKUN untuk konfirmasi.",
  }),
});

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
export type UserPasswordUpdateInput = z.infer<typeof userPasswordUpdateSchema>;
export type DeleteUserTransactionsInput = z.infer<typeof deleteUserTransactionsSchema>;
export type DeleteUserAccountInput = z.infer<typeof deleteUserAccountSchema>;
