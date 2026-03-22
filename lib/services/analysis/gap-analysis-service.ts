import { generateSeedSuggestions } from "@/lib/services/analysis/suggestion-generator";

export type AnalysisInput = {
  jdText: string;
  talentProfile?: {
    headline: string;
    confidenceNote: string;
  };
  careerDirection?: {
    label: string;
    rationale: string;
  };
  facts: Array<{
    text: string;
    section?: string;
    title?: string;
  }>;
};

export type AnalysisResult = {
  fitScore: number;
  optimizationMode: "baseline_jd_match" | "talent_amplified";
  strengths: string[];
  gaps: string[];
  riskNotes: string[];
  suggestions: ReturnType<typeof generateSeedSuggestions>;
};

const positiveSignals = [
  "ai",
  "product",
  "workflow",
  "system",
  "user",
  "prompt",
  "automation",
  "design"
];

export async function analyzeDraft(input: AnalysisInput): Promise<AnalysisResult> {
  const normalizedJd = input.jdText.toLowerCase();
  const normalizedFacts = input.facts.map((fact) => fact.text.toLowerCase()).join(" ");
  const matchedSignals = positiveSignals.filter(
    (signal) => normalizedJd.includes(signal) && normalizedFacts.includes(signal)
  );
  const hasTalentProfile = Boolean(input.talentProfile);
  const optimizationMode = hasTalentProfile ? "talent_amplified" : "baseline_jd_match";
  const talentBonus = hasTalentProfile ? 6 : 0;
  const directionBonus = input.careerDirection ? 4 : 0;

  const fitScore = Math.min(94, 48 + matchedSignals.length * 7 + Math.min(input.facts.length, 4) * 3 + talentBonus + directionBonus);

  const strengths = [
    matchedSignals.length > 0
      ? `Strong overlap on: ${matchedSignals.slice(0, 4).join(", ")}.`
      : "The current fact set shows product-adjacent signal but needs tighter JD alignment.",
    hasTalentProfile
      ? `Your confirmed strengths profile now changes the optimization goal: we are not only matching the JD, we are surfacing the kind of work where you naturally perform best.`
      : "The source material already points to workflow design and structured operating thinking.",
    ...(input.careerDirection
      ? [`Your selected direction (${input.careerDirection.label}) gives the draft a clearer narrative spine for what to foreground.`]
      : [])
  ];

  const gaps = [
    hasTalentProfile
      ? "The draft now needs at least one or two bullets that explicitly show your natural edge, not just what tasks you completed."
      : normalizedJd.includes("metrics")
        ? "The draft needs sharper numerical outcome framing to match the JD's results emphasis."
        : "The draft still needs one or two clearer result statements to feel hiring-ready.",
    hasTalentProfile
      ? "Do not let talent language float above the evidence. Every strength claim still needs to be tied back to a real story or result."
      : normalizedJd.includes("manager")
        ? "Leadership and cross-functional influence should be made more explicit."
        : "Role-fit framing should be tightened so the top blocks reflect the target title immediately."
  ];

  const riskNotes = [
    "Do not let inferred capability statements drift into unverified fact claims.",
    "Keep every rewrite anchored to an existing fact block or a confirmed new fact submission.",
    ...(hasTalentProfile
      ? ["Once talent discovery exists, the danger is no longer being too generic; it is becoming inspirational without staying concrete."]
      : [])
  ];

  const suggestions = generateSeedSuggestions({
    jdText: input.jdText,
    talentHeadline: input.talentProfile?.headline,
    selectedCareerDirectionLabel: input.careerDirection?.label,
    facts: input.facts
  });

  return {
    fitScore,
    optimizationMode,
    strengths,
    gaps,
    riskNotes,
    suggestions
  };
}
