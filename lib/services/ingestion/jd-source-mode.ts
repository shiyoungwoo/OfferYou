export type JdSourceType = "text" | "pdf" | "image" | "url";

export type JdRecognitionMode = "basic" | "standard_ai" | "high_quality_ai";

export type JdRecognitionDecision = {
  mode: JdRecognitionMode;
  canAutoProceed: boolean;
  requiresUserConfirmation: boolean;
  description: string;
};

export type JdRecognitionInput = {
  sourceType: JdSourceType;
  requestedMode?: JdRecognitionMode;
  hasReliableText?: boolean;
  hasOcrLayoutBlocks?: boolean;
  hasVisionModel?: boolean;
};

export function resolveJdRecognitionMode(input: JdRecognitionInput): JdRecognitionDecision {
  const requestedMode = input.requestedMode ?? "standard_ai";

  if (requestedMode === "basic") {
    return {
      mode: "basic",
      canAutoProceed: false,
      requiresUserConfirmation: true,
      description: "基础模式合并基础编辑与低成本文本处理：可保存用户填写内容；若文本可靠且模型可用，可进入轻量 JD 理解，但不伪装截图识别。"
    };
  }

  if (input.sourceType === "text" || input.sourceType === "url") {
    return {
      mode: requestedMode,
      canAutoProceed: Boolean(input.hasReliableText),
      requiresUserConfirmation: !input.hasReliableText,
      description: input.hasReliableText
        ? "文本 JD 可直接进入模型理解。"
        : "文本 JD 缺少可用正文，需要用户补充或确认。"
    };
  }

  if (input.sourceType === "pdf") {
    return {
      mode: requestedMode,
      canAutoProceed: Boolean(input.hasReliableText),
      requiresUserConfirmation: !input.hasReliableText,
      description: input.hasReliableText
        ? "PDF JD 先由工具提取文本，再交给模型理解。"
        : "PDF JD 未提取到可靠文本，需要用户确认或补充。"
    };
  }

  if (input.sourceType === "image" && requestedMode === "high_quality_ai") {
    return {
      mode: "high_quality_ai",
      canAutoProceed: Boolean(input.hasVisionModel),
      requiresUserConfirmation: !input.hasVisionModel,
      description: input.hasVisionModel
        ? "截图 JD 使用视觉模型识别当前选中岗位与正文。"
        : "截图 JD 需要视觉模型；模型不可用时不能继续伪识别。"
    };
  }

  if (input.sourceType === "image") {
    return {
      mode: "standard_ai",
      canAutoProceed: Boolean(input.hasOcrLayoutBlocks && input.hasVisionModel),
      requiresUserConfirmation: true,
      description: input.hasOcrLayoutBlocks && input.hasVisionModel
        ? "标准 AI 使用 OCR 坐标和模型共同判断，但截图中可能有多个公司与岗位，默认要求用户确认。"
        : "截图 JD 缺少可靠 OCR 版面块，需要用户确认或启用视觉模型。"
    };
  }

  return {
    mode: "basic",
    canAutoProceed: false,
    requiresUserConfirmation: true,
    description: "无法确认 JD 来源类型，已进入基础模式。"
  };
}
