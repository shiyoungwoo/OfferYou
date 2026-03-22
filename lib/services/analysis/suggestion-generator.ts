export type SuggestionSeedInput = {
  jdText: string;
  talentHeadline?: string;
  selectedCareerDirectionLabel?: string;
  facts: Array<{
    text: string;
    section?: string;
    title?: string;
    sourceKind?: "resume_baseline" | "master_fact" | "target_role_fit";
    sourceLabel?: string;
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
  revisionRound: number;
  sourceKind: "resume_baseline" | "master_fact" | "target_role_fit" | "revision";
  sourceLabel: string;
};

export function generateSeedSuggestions(input: SuggestionSeedInput): SuggestionSeed[] {
  return input.facts.slice(0, 3).map((fact, index) => ({
    id: `seed-${index + 1}`,
    section: fact.section ?? "experience",
    title: fact.title ?? `Suggestion ${index + 1}`,
    beforeText: fact.text,
    afterText: rewriteFactForJd(fact.text, input.jdText, {
      talentHeadline: input.talentHeadline,
      selectedCareerDirectionLabel: input.selectedCareerDirectionLabel,
      sourceKind: fact.sourceKind
    }),
    reasonText: getReasonText({
      hasTalentProfile: Boolean(input.talentHeadline),
      sourceKind: fact.sourceKind
    }),
    status: "pending",
    revisionRound: 0,
    sourceKind: fact.sourceKind ?? "resume_baseline",
    sourceLabel: fact.sourceLabel ?? getDefaultSourceLabel(fact.sourceKind)
  }));
}

function getReasonText({
  hasTalentProfile,
  sourceKind
}: {
  hasTalentProfile: boolean;
  sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"];
}) {
  if (sourceKind === "master_fact") {
    return "这版改写会保留已经确认过的真实事实，同时让这段经历和目标岗位的关系更清楚。";
  }

  if (hasTalentProfile) {
    return "这版改写不会改变事实本身，但会更主动地把你底层的优势和自然工作方式写出来。";
  }

  return "这版改写会让这段经历更贴近 JD 重点，同时不增加你没有提供过的内容。";
}

function getDefaultSourceLabel(sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"]) {
  if (sourceKind === "master_fact") {
    return "Master fact";
  }

  if (sourceKind === "target_role_fit") {
    return "Role-fit framing";
  }

  return "Resume baseline";
}

function rewriteFactForJd(
  fact: string,
  jdText: string,
  context?: {
    talentHeadline?: string;
    selectedCareerDirectionLabel?: string;
    sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"];
  }
) {
  const jd = jdText.toLowerCase();
  const hasTalentProfile = Boolean(context?.talentHeadline);
  const directionLabel = context?.selectedCareerDirectionLabel;

  if (context?.sourceKind === "master_fact") {
    return `${fact} Keep the truth intact, then foreground why this evidence matters for the target role.`;
  }

  if (hasTalentProfile && directionLabel) {
    return `${fact} Reframe the block to surface the user's underlying strengths profile and show why it supports ${directionLabel}.`;
  }

  if (hasTalentProfile) {
    return `${fact} Reframe the block to make the user's underlying talent and natural working edge more visible, not just the task list.`;
  }

  if (jd.includes("workflow")) {
    return `${fact} The emphasis should stay on workflow design, operator thinking, and repeatable execution.`;
  }

  if (jd.includes("product")) {
    return `${fact} Reframe the block to make the product decision-making and user impact more explicit.`;
  }

  return `${fact} Reframe the block to match the target role's strongest decision and outcome signals.`;
}
