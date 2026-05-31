import { z } from "zod";

const optionalTextSchema = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const pocketSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kantong wajib diisi.")
    .max(50, "Nama kantong maksimal 50 karakter."),
  icon: optionalTextSchema(40, "Nama ikon maksimal 40 karakter.").refine(
    (value) => value === undefined || /^[A-Za-z][A-Za-z0-9]*$/.test(value),
    "Nama ikon tidak valid.",
  ),
  color: optionalTextSchema(7, "Kode warna maksimal 7 karakter.").refine(
    (value) => value === undefined || /^#[0-9A-F]{6}$/i.test(value),
    "Format warna harus berupa hex, misalnya #2563EB.",
  ),
  initialBalance: z.coerce
    .number()
    .refine(Number.isFinite, "Saldo awal tidak valid.")
    .min(0, "Saldo awal tidak boleh negatif.")
    .max(999_999_999_999, "Saldo awal terlalu besar."),
});

export const pocketUpdateSchema = pocketSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  {
    message: "Tidak ada data kantong yang dikirim.",
  },
);

export type PocketInput = z.infer<typeof pocketSchema>;
export type PocketUpdateInput = z.infer<typeof pocketUpdateSchema>;
