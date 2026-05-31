import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const budgetPeriodSchema = z.enum(["weekly", "monthly", "yearly"], {
  message: "Periode budget tidak valid.",
});

const budgetBaseSchema = z.object({
  limit: z.coerce
    .number()
    .refine(Number.isFinite, "Limit budget tidak valid.")
    .positive("Limit budget harus lebih dari 0.")
    .max(999_999_999_999, "Limit budget terlalu besar."),
  period: budgetPeriodSchema,
  startDate: z.coerce.date("Tanggal mulai tidak valid."),
  endDate: z.coerce.date("Tanggal akhir tidak valid."),
  categoryId: z.preprocess(emptyToUndefined, z.string().cuid("Kategori budget tidak valid.")),
});

export const budgetSchema = budgetBaseSchema.refine((data) => data.startDate <= data.endDate, {
  path: ["endDate"],
  message: "Tanggal akhir harus setelah tanggal mulai.",
});

export const budgetUpdateSchema = budgetBaseSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Tidak ada data budget yang dikirim.",
  })
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    path: ["endDate"],
    message: "Tanggal akhir harus setelah tanggal mulai.",
  });

export type BudgetInput = z.infer<typeof budgetSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
