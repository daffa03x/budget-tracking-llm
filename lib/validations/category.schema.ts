import { z } from "zod";

export const categoryTypeSchema = z.enum(["income", "expense", "both"], {
  message: "Tipe kategori tidak valid.",
});

const optionalTextSchema = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi.")
    .max(50, "Nama kategori maksimal 50 karakter."),
  icon: optionalTextSchema(40, "Nama ikon maksimal 40 karakter.").refine(
    (value) => value === undefined || /^[A-Za-z][A-Za-z0-9]*$/.test(value),
    "Nama ikon tidak valid.",
  ),
  color: optionalTextSchema(7, "Kode warna maksimal 7 karakter.").refine(
    (value) => value === undefined || /^#[0-9A-F]{6}$/i.test(value),
    "Format warna harus berupa hex, misalnya #2563EB.",
  ),
  type: categoryTypeSchema,
});

export const categoryUpdateSchema = categorySchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  {
    message: "Tidak ada data kategori yang dikirim.",
  },
);

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
