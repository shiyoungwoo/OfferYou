import { z } from "zod";

export const integrityNoticeSchema = z.object({
  confirmed: z.literal(true),
  confirmedAt: z.string().datetime()
});

export const createFactInputSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(3),
  summary: z.string().min(10),
  blockType: z.enum(["summary", "experience", "project", "education", "skill", "certificate", "other"]),
  integrityNoticeConfirmedAt: z.string().datetime()
});

export const insightConfirmationSchema = z.object({
  insightId: z.string().min(1),
  action: z.enum(["confirm", "reject", "revise"])
});
