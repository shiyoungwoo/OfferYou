export type DraftInputPreview = {
  fitScore: number;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
};

const signalWords = ["customer", "workflow", "coordination", "design", "analysis", "trust", "delivery", "operations"];

export function buildDraftInputPreview(input: { jdContent: string; resumeContent: string; hasResumeFile: boolean }): DraftInputPreview {
  const normalizedJd = input.jdContent.toLowerCase();
  const normalizedResume = input.resumeContent.toLowerCase();
  const overlaps = signalWords.filter((word) => normalizedJd.includes(word) && normalizedResume.includes(word));
  const evidenceCount = overlaps.length + (input.hasResumeFile ? 1 : 0);
  const fitScore = Math.max(35, Math.min(89, 42 + evidenceCount * 8));

  const strengths = [
    overlaps.length > 0
      ? `发现了和岗位重合的关键词：${overlaps.slice(0, 4).join("、")}。`
      : "还没看到明显的岗位关键词重合，建议先补充更贴近岗位的经历描述。",
    input.resumeContent.trim().length > 80
      ? "目前的初版简历已经提供了一些可改写的原始素材。"
      : "目前简历素材偏少，建议补充更完整的经历片段。"
  ];

  const gaps = [
    normalizedJd.includes("metrics")
      ? "岗位强调结果指标，建议补充数据或成果证据。"
      : "建议补一到两个更明确的结果或影响描述。",
    input.hasResumeFile || input.resumeContent.trim().length > 20
      ? "可以进一步把经历改写得更贴近目标岗位语境。"
      : "请先上传或粘贴初版简历内容，右侧建议才会更可靠。"
  ];

  const suggestions = [
    "优先改写最能体现优势的 1 到 2 段经历，而不是通篇重写。",
    "把“做过什么”转成“为什么适合这个岗位”。",
    "用户确认后，再生成优化版简历进入预览页。"
  ];

  return {
    fitScore,
    strengths,
    gaps,
    suggestions
  };
}
