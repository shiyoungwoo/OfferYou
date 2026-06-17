import { z } from "zod";

const excavationTurnSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  reflection: z.string().optional(),
  requiredAnchor: z.enum(["early_memory", "unconscious_competence", "energy_audit", "jealousy_signal", "follow_up"]).optional()
});

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
  followUpNotes: z.string().optional(),
  excavationTranscript: z.array(excavationTurnSchema).optional(),
  talentManual: z.string().optional()
});

export const confirmTalentProfileInputSchema = z.object({
  answers: optionalAnswerSchema.refine((answers) => hasValidAnswerSet(answers), {
    message: "Talent answers are incomplete for the selected discovery mode."
  })
});

export const confirmCareerNavigationInputSchema = z.object({
  talentProfileId: z.string().min(1)
});

export const talentExcavationInputSchema = z.object({
  action: z.enum(["next_question", "finalize"]),
  turns: z.array(excavationTurnSchema).default([])
});

export const talentExcavationDraftInputSchema = z.object({
  turns: z.array(excavationTurnSchema).default([]),
  talentManual: z.string().optional(),
  profile: z.unknown().optional()
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
  const excavationSet =
    (answers.excavationTranscript ?? []).filter((turn) => hasText(turn.answer)).length >= 4;

  return legacySet || radarSet || deepSet || excavationSet;
}
