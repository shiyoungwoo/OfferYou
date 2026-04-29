import { z } from "zod";
import type { ModelProviderKey } from "@/lib/ai/model-provider-config";

export const resumeEntrySectionSchema = z.enum(["summary", "work", "project", "education", "supplement", "other"]);
export const resumeCalibrationStatusSchema = z.enum(["pending", "needs_review", "confirmed"]);
export const resumeFieldConfidenceSchema = z.enum(["high", "medium", "low"]);

export const calibratedResumeEntrySchema = z.object({
  id: z.string(),
  section: resumeEntrySectionSchema,
  title: z.string(),
  organization: z.string().optional(),
  role: z.string().optional(),
  dateRange: z.string().optional(),
  bullets: z.array(z.string()),
  sourceText: z.string(),
  confidence: resumeFieldConfidenceSchema,
  issues: z.array(z.string())
});

export const calibratedResumeProfileSchema = z.object({
  status: resumeCalibrationStatusSchema,
  personalInfo: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    location: z.string().optional(),
    portfolio: z.string().optional(),
    github: z.string().optional(),
    educationSummary: z.string().optional()
  }),
  entries: z.array(calibratedResumeEntrySchema),
  unclassifiedText: z.array(z.string()),
  parseWarnings: z.array(z.string()),
  modelNotes: z.array(z.string()),
  modelProvider: z.custom<ModelProviderKey>().optional(),
  updatedAt: z.string().optional()
});

export type ResumeEntrySection = z.infer<typeof resumeEntrySectionSchema>;
export type ResumeCalibrationStatus = z.infer<typeof resumeCalibrationStatusSchema>;
export type ResumeFieldConfidence = z.infer<typeof resumeFieldConfidenceSchema>;
export type CalibratedResumeEntry = z.infer<typeof calibratedResumeEntrySchema>;
export type CalibratedResumeProfile = z.infer<typeof calibratedResumeProfileSchema>;
