/**
 * Central utility for cleaning resume and JD text across the application.
 * Fixes OCR errors, normalizes formatting, and prepares text for display or AI processing.
 */

export function normalizeOcrResumeText(text: string) {
  if (!text) return "";
  
  return text
    // PDF browser headers/footers should never enter resume facts.
    .replace(/^\s*\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}.*简历\s*$/gmu, "")
    .replace(/^\s*第\s*\d+\s*\/\s*\d+\s*页.*$/gmu, "")
    .replace(/^\s*file:\/\/\/tmp\/resume[-\w./]*\.html\s*$/gmu, "")
    .replace(/^#{1,6}\s+/gmu, "")
    // Intelligent OCR fix-ups for branding and common errors
    .replace(/\$O[&&]erYou\$/g, "OfferYou")
    .replace(/O["'""\u201c\u2018]\s*erYou/g, "OfferYou")
    .replace(/O"erYou/g, "OfferYou")
    .replace(/\$O''erYou\$/g, "OfferYou")
    .replace(/O&erYou/g, "OfferYou")
    .replace(/O\s*[&＆]\s*erYou/giu, "OfferYou")
    .replace(/O\s*"\s*erYou/g, "OfferYou")
    .replace(/OfferYou\s*\)/g, "OfferYou")
    .replace(/\bOfferYou\s+AI/gu, "OfferYou AI")
    .replace(/\s%+\s/g, " | ")
    // OCR: 「」Chinese book-title quotes misread as $...$  — run BEFORE bare $ stripping
    // Pattern: $some text$ where inner text is short and plausible (not a price)
    .replace(/\$([^\$\n]{1,80})\$/gu, (_, inner) => `「${inner}」`)
    // OCR: bare $ adjacent to Chinese/arrow (leading or trailing after above fix)
    .replace(/\$(?=[\u4e00-\u9fa5A-Za-z\u2192→])/gu, "")
    .replace(/(?<=[\u4e00-\u9fa5A-Za-z\u2192→])\$/gu, "")
    // OCR: em-dash 「——」 sometimes produces stray - or — between arrows
    .replace(/(?<=→)\s*\$\s*(?=→)/gu, " → ")
    // OCR: Remove isolated "junk" characters like stray asterisks, tildes, backticks, or underscores
    .replace(/(?<=^|\s)[*~`_\\^]{1,2}(?=\s|$)/g, "")
    // OCR: Clean up stray pipe characters or bullet points that are not separators
    .replace(/(?<=[\u4e00-\u9fa5A-Za-z])\s*[|｜·]\s*(?=[\u4e00-\u9fa5A-Za-z])/gu, " | ")
    // Preserve line breaks because downstream title extraction depends on resume structure.
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/ *\r?\n+ */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanOriginalResumeText(text: string) {
  // Light cleaning for original text to preserve user styling while fixing OCR bugs
  return normalizeOcrResumeText(text);
}

export function cleanGeneratedResumeText(text: string) {
  return normalizeOcrResumeText(text)
    .replace(/([产品项目])OfferYou/gu, "$1 OfferYou")
    .replace(/^围绕[^，。；]{2,48}[，。；]\s*/u, "")
    // Remove common AI preambles that users find annoying
    .replace(/^这段经历与目标\s*JD\s*相关性较弱，(?:目前)?仅保留时间[及、和]岗位[。.]?\s*(?:改进建议[:：])?\s*/iu, "")
    .replace(/^建议在此经历中补充与.+?相关的具体动作或成果描述，以增强竞争力[。.]?\s*/u, "")
    .replace(/，?强化这段经历与目标岗位职责之间的对应关系。?$/u, "")
    .replace(/，?让真实经历中的优势、动作 and 结果更容易被识别。?$/u, "")
    .replace(/，?保留原有事实基础并突出可迁移能力。?$/u, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/ *\r?\n+ */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
