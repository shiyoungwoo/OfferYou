export type SuggestionSeedInput = {
  jdText: string;
  facts: Array<{
    text: string;
    section?: string;
    title?: string;
  }>;
};

export type SuggestionSeed = {
  id: string;
  section: string;
  title: string;
  beforeText: string;
  afterText: string;
  reasonText: string;
  status: "pending";
};

export function generateSeedSuggestions(input: SuggestionSeedInput): SuggestionSeed[] {
  return input.facts.slice(0, 3).map((fact, index) => ({
    id: `seed-${index + 1}`,
    section: fact.section ?? "experience",
    title: fact.title ?? `Suggestion ${index + 1}`,
    beforeText: fact.text,
    afterText: rewriteFactForJd(fact.text, input.jdText),
    reasonText: "This version brings the block closer to the JD emphasis without inventing new facts.",
    status: "pending"
  }));
}

function rewriteFactForJd(fact: string, jdText: string) {
  const jd = jdText.toLowerCase();

  if (jd.includes("workflow")) {
    return `${fact} The emphasis should stay on workflow design, operator thinking, and repeatable execution.`;
  }

  if (jd.includes("product")) {
    return `${fact} Reframe the block to make the product decision-making and user impact more explicit.`;
  }

  return `${fact} Reframe the block to match the target role's strongest decision and outcome signals.`;
}
