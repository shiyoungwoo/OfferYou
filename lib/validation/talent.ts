import { z } from "zod";

const optionalAnswerSchema = z.object({
  discoveryMode: z.enum(["radar", "deep"]).optional(),
  proudMoment: z.string().optional(),
  trustedProblem: z.string().optional(),
  energyPattern: z.string().optional(),
  unconsciousCompetence: z.string().optional(),
  energyAudit: z.string().optional(),
  jealousySignal: z.string().optional(),
  preConditioningMemory: z.string().optional(),
  adultUnconsciousCompetence: z.string().optional(),
  energyRecharge: z.string().optional(),
  jealousyDecode: z.string().optional(),
  followUpNotes: z.string().optional()
});

export const confirmTalentProfileInputSchema = z.object({
  answers: optionalAnswerSchema.refine((answers) => hasValidAnswerSet(answers), {
    message: "Talent answers are incomplete for the selected discovery mode."
  })
});

export const confirmCareerNavigationInputSchema = z.object({
  talentProfileId: z.string().min(1)
});

function hasValidAnswerSet(answers: z.infer<typeof optionalAnswerSchema>) {
  const hasText = (value?: string) => Boolean(value && value.trim().length >= 10);

  const legacySet =
    hasText(answers.proudMoment) && hasText(answers.trustedProblem) && hasText(answers.energyPattern);
  const radarSet =
    hasText(answers.unconsciousCompetence) && hasText(answers.energyAudit) && hasText(answers.jealousySignal);
  const deepSet =
    hasText(answers.preConditioningMemory) &&
    hasText(answers.adultUnconsciousCompetence) &&
    hasText(answers.energyRecharge) &&
    hasText(answers.jealousyDecode);

  return legacySet || radarSet || deepSet;
}
