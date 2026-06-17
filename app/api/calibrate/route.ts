import { z } from "zod";
import { NextResponse } from "next/server";
import { calibrateResumeStructure } from "@/lib/services/calibration/resume-calibration-service";

const calibrateSchema = z.object({
  resumeText: z.string().min(20, "简历文本过短，无法解析。").max(500_000, "简历文本过长，请缩短后重试。")
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = calibrateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = await calibrateResumeStructure({ resumeText: parsed.data.resumeText });
    return NextResponse.json(profile);
  } catch (error) {
    console.error("[API /calibrate] unexpected error:", error);
    return NextResponse.json(
      { error: "简历校准服务暂时不可用，请稍后重试。" },
      { status: 500 }
    );
  }
}
