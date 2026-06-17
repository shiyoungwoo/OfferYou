import { NextResponse } from "next/server";
import { createApplicationRecord } from "@/lib/services/applications/application-record-service";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;
  const draft = await readWorkspaceDraft(draftId);

  if (!draft) {
    return NextResponse.json({ error: "未找到简历草稿。" }, { status: 404 });
  }

  if (!draft.company.trim()) {
    return NextResponse.json({ error: "当前只是简历优化草稿，没有目标公司，不能记录为投递。" }, { status: 400 });
  }

  try {
    const record = await createApplicationRecord({ draftId });
    return NextResponse.json({
      recordId: record.id,
      recordPath: `/applications/${draftId}/record`
    }, { status: 201 });
  } catch (error) {
    console.error("[API /application-record] create failed:", error);
    return NextResponse.json(
      { error: "创建投递记录失败，请确认已生成预览快照。" },
      { status: 500 }
    );
  }
}
