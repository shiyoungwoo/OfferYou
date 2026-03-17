export async function extractTextFromResumeSource(input: { content?: string; rawReference?: string }) {
  if (input.content) {
    return input.content;
  }

  if (input.rawReference) {
    return `Extracted placeholder text from ${input.rawReference}`;
  }

  return "";
}
