import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const emptyToNull = (value: unknown) => (value === "" ? null : value);

export const transactionTypeSchema = z.enum(["income", "expense"], {
  message: "Tipe transaksi tidak valid.",
});

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(255, "Deskripsi maksimal 255 karakter.")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const optionalCategoryIdSchema = z.preprocess(
  emptyToNull,
  z.string().cuid("Kategori tidak valid.").nullable().optional(),
);

const optionalPocketIdSchema = z.preprocess(
  emptyToNull,
  z.string().cuid("Kantong tidak valid.").nullable().optional(),
);

export const transactionSchema = z.object({
  amount: z.coerce
    .number()
    .refine(Number.isFinite, "Jumlah transaksi tidak valid.")
    .positive("Jumlah harus lebih dari 0.")
    .max(999_999_999_999, "Jumlah transaksi terlalu besar."),
  type: transactionTypeSchema,
  description: optionalDescriptionSchema,
  date: z.coerce.date("Tanggal transaksi tidak valid."),
  categoryId: optionalCategoryIdSchema,
  pocketId: optionalPocketIdSchema,
});

export const transactionUpdateSchema = transactionSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  {
    message: "Tidak ada data transaksi yang dikirim.",
  },
);

export const transactionFiltersSchema = z
  .object({
    startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    categoryId: z.preprocess(emptyToUndefined, z.string().cuid("Kategori tidak valid.").optional()),
    pocketId: z.preprocess(emptyToUndefined, z.string().cuid("Kantong tidak valid.").optional()),
    type: z.preprocess(emptyToUndefined, transactionTypeSchema.optional()),
    search: z
      .preprocess(emptyToUndefined, z.string().trim().max(100, "Pencarian maksimal 100 karakter.").optional())
      .transform((value) => (value === "" ? undefined : value)),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    {
      path: ["endDate"],
      message: "Tanggal akhir harus setelah tanggal mulai.",
    },
  );

export type TransactionInput = z.infer<typeof transactionSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
