import type { InterviewPrepRecord } from "@/lib/services/interview/interview-prep-service";

export function getInterviewContextSavedMessage(generationMode: InterviewPrepRecord["generationMode"]) {
  if (generationMode === "model" || generationMode === "model_repaired") {
    return "岗位资料已保存，并已基于当前资料重新生成 AI 面试准备。";
  }

  return "岗位资料已保存；当前仍是基础准备版，请补充 JD、公司资料或检查模型配置后再生成深度问题。";
}
