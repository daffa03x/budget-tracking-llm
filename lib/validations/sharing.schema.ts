import { z } from "zod";

export const sharingInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email akun tidak valid.")
    .transform((value) => value.toLowerCase()),
});

export const sharingActionSchema = z.object({
  action: z.enum(["accept", "reject"], {
    message: "Aksi undangan tidak valid.",
  }),
});

export type SharingInviteInput = z.infer<typeof sharingInviteSchema>;
export type SharingActionInput = z.infer<typeof sharingActionSchema>;
