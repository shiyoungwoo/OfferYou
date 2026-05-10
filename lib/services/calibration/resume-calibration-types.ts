import { z } from "zod";
import type { ModelProviderKey } from "@/lib/ai/model-provider-config";

export const resumeEntrySectionSchema = z.enum([
  "summary",
  "work",
  "project",
  "education",
  "credential",
  "personal_info",
  "other_needs_review"
]);

/** Legacy sections from old data. Used only during read-side normalization. */
export const legacyResumeEntrySectionSchema = z.enum(["supplement", "other"]);
export const rawResumeEntrySectionSchema = resumeEntrySectionSchema.or(legacyResumeEntrySectionSchema);
export const resumeCalibrationStatusSchema = z.enum(["pending", "needs_review", "confirmed"]);
export const resumeFieldConfidenceSchema = z.enum(["high", "medium", "low"]);

export const calibratedResumeEntrySchema = z.object({
  id: z.string(),
  candidateId: z.string().optional(),
  section: rawResumeEntrySectionSchema,
  sectionType: rawResumeEntrySectionSchema.optional(),
  title: z.string(),
  organization: z.string().optional(),
  role: z.string().optional(),
  dateRange: z.string().optional(),
  bullets: z.array(z.string()),
  sourceText: z.string(),
  rawText: z.string().optional(),
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

/**
 * Normalize a raw/legacy section value to the canonical enum.
 * - "supplement" → "credential"
 * - "other" → "other_needs_review"
 * - anything else passes through as-is (must already be a valid canonical section)
 */
export function normalizeResumeEntrySection(section: string): ResumeEntrySection {
  if (section === "supplement") return "credential";
  if (section === "other") return "other_needs_review";
  const parsed = resumeEntrySectionSchema.safeParse(section);
  return parsed.success ? parsed.data : "other_needs_review";
}
