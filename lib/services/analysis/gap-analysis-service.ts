import { generateSeedSuggestions } from "@/lib/services/analysis/suggestion-generator";

export type AnalysisInput = {
  jdText: string;
  facts: Array<{
    text: string;
    section?: string;
    title?: string;
  }>;
};

export type AnalysisResult = {
  fitScore: number;
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

  const fitScore = Math.min(92, 48 + matchedSignals.length * 7 + Math.min(input.facts.length, 4) * 3);

  const strengths = [
    matchedSignals.length > 0
      ? `Strong overlap on: ${matchedSignals.slice(0, 4).join(", ")}.`
      : "The current fact set shows product-adjacent signal but needs tighter JD alignment.",
    "The source material already points to workflow design and structured operating thinking."
  ];

  const gaps = [
    normalizedJd.includes("metrics")
      ? "The draft needs sharper numerical outcome framing to match the JD's results emphasis."
      : "The draft still needs one or two clearer result statements to feel hiring-ready.",
    normalizedJd.includes("manager")
      ? "Leadership and cross-functional influence should be made more explicit."
      : "Role-fit framing should be tightened so the top blocks reflect the target title immediately."
  ];

  const riskNotes = [
    "Do not let inferred capability statements drift into unverified fact claims.",
    "Keep every rewrite anchored to an existing fact block or a confirmed new fact submission."
  ];

  const suggestions = generateSeedSuggestions({
    jdText: input.jdText,
    facts: input.facts
  });

  return {
    fitScore,
    strengths,
    gaps,
    riskNotes,
    suggestions
  };
}
