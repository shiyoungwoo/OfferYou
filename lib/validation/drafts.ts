import { z } from "zod";

export const createDraftInputSchema = z.object({
  company: z.string().min(2),
  jobTitle: z.string().min(2),
  language: z.enum(["zh", "en", "auto"]).default("auto"),
  masterResumeId: z.string().min(1),
  careerDirectionSlug: z.string().min(1).optional(),
  jdContent: z.string().min(20),
  resumeAssetRef: z.string().min(1).optional(),
  resumeContent: z.string().min(1).optional(),
  profilePhotoAssetRef: z.string().min(1).optional()
});

export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;
