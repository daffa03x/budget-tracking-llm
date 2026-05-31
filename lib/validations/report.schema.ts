import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const monthSchema = z.coerce
  .number()
  .int("Bulan harus berupa angka.")
  .min(1, "Bulan minimal 1.")
  .max(12, "Bulan maksimal 12.");

const yearSchema = z.coerce
  .number()
  .int("Tahun harus berupa angka.")
  .min(2000, "Tahun terlalu kecil.")
  .max(2100, "Tahun terlalu besar.");

const dateSchema = z.coerce.date("Tanggal tidak valid.");

export const reportSummaryQuerySchema = z.object({
  month: z.preprocess(emptyToUndefined, monthSchema.optional()),
  year: z.preprocess(emptyToUndefined, yearSchema.optional()),
});

export const reportMonthlyQuerySchema = z.object({
  months: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int("Jumlah bulan harus berupa angka.")
      .min(1, "Jumlah bulan minimal 1.")
      .max(24, "Jumlah bulan maksimal 24.")
      .default(6),
  ),
  year: z.preprocess(emptyToUndefined, yearSchema.optional()),
  startMonth: z.preprocess(emptyToUndefined, monthSchema.optional()),
  endMonth: z.preprocess(emptyToUndefined, monthSchema.optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().cuid("Kategori tidak valid.").optional()),
});

const reportRangeBaseSchema = z.object({
  year: z.preprocess(emptyToUndefined, yearSchema.optional()),
  startMonth: z.preprocess(emptyToUndefined, monthSchema.optional()),
  endMonth: z.preprocess(emptyToUndefined, monthSchema.optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().cuid("Kategori tidak valid.").optional()),
  pocketId: z.preprocess(emptyToUndefined, z.string().cuid("Kantong tidak valid.").optional()),
});

const validMonthRange = (data: { startMonth?: number; endMonth?: number }) =>
  !data.startMonth || !data.endMonth || data.startMonth <= data.endMonth;

export const reportRangeQuerySchema = reportRangeBaseSchema
  .extend({
    tab: z.preprocess(emptyToUndefined, z.enum(["monthly", "category", "trend"]).optional()),
  })
  .refine(validMonthRange, {
    path: ["endMonth"],
    message: "Bulan akhir harus setelah bulan awal.",
  });

export const reportExportQuerySchema = reportRangeBaseSchema.extend({
  startDate: z.preprocess(emptyToUndefined, dateSchema.optional()),
  endDate: z.preprocess(emptyToUndefined, dateSchema.optional()),
  type: z.preprocess(emptyToUndefined, z.enum(["income", "expense"]).optional()),
  search: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100, "Pencarian maksimal 100 karakter.").optional(),
  ),
}).refine(validMonthRange, {
  path: ["endMonth"],
  message: "Bulan akhir harus setelah bulan awal.",
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  {
    path: ["endDate"],
    message: "Tanggal akhir harus setelah tanggal mulai.",
  },
);

export type ReportSummaryQuery = z.infer<typeof reportSummaryQuerySchema>;
export type ReportMonthlyQuery = z.infer<typeof reportMonthlyQuerySchema>;
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
