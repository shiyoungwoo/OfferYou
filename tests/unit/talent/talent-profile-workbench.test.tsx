import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TalentProfileWorkbench } from "@/components/talent/talent-profile-workbench";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value)
  } as Storage;
}

describe("TalentProfileWorkbench", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage()
    });
    window.localStorage.clear();
  });

  it("renders a talent profile card and refreshes it from the user's answers", () => {
    render(<TalentProfileWorkbench />);

    expect(screen.getAllByText("优势档案").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "快速填写" })).toBeTruthy();
    expect(screen.getByText(/当前可信度/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/身体很累，但脑子反而越来越兴奋/i), {
      target: {
        value: "安静、专注、深度工作的状态会让我身体累，但脑子很兴奋，也让我想继续做下去。"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "生成优势档案" }));

    expect(screen.getByText(/需要一段相对安静、连续的思考时间/)).toBeTruthy();
  });

  it("switches into deep discovery and asks the next model-driven question", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: "question",
        question: "16 岁以前，在没人要求你的情况下，你会反复去做什么？",
        reflection: "先从早期线索开始。",
        requiredAnchor: "early_memory",
        progress: {
          current: 1,
          max: 10,
          canFinalize: false
        },
        generationMode: "model",
        modelProvider: "openai_compatible"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TalentProfileWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "深度填写" }));

    expect(await screen.findByText(/逐轮回答问题，生成天赋说明书/)).toBeTruthy();
    expect((await screen.findAllByText(/16 岁以前/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/AI 深度追问/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交并继续追问" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完成 4 轮后生成" }).hasAttribute("disabled")).toBe(true);
  });

  it("confirms talent card, then confirms career directions and unlocks role-matching links", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "talent-1",
          userId: "default-user",
          status: "confirmed",
          confirmedAt: "2026-03-21T00:00:00.000Z",
          answers: {
            discoveryMode: "radar",
            unconsciousCompetence: "我很擅长把混乱的工作理清楚，并让大家知道下一步做什么。",
            energyAudit: "和人一起拆复杂问题会让我身体累，但脑子越来越兴奋。",
            jealousySignal: "我羡慕那些能带着团队往前走、又能讲清楚复杂事情的人。"
          },
          profile: {
            headline: "你最容易发光的状态，是作为“梳理混乱的人”。",
            summary: "Summary",
            signals: [
              {
                key: "clarity_builder",
                label: "梳理混乱的人",
                description: "能把混乱、模糊或卡住的事情梳理成清晰结构和下一步。",
                evidence: ["A proud moment with a customer project."]
              }
            ],
            workStyle: ["协作推进、复杂信息整理、跨角色沟通。"],
            suitableDirections: ["客户成功、客户关系与服务推进类方向"],
            cautionNotes: ["先把这份结果当作方向参考，再拿 2 到 3 个真实岗位去验证，会更稳。"],
            confidenceNote: "当前可信度为中等：你的回答里已经出现了多组重复信号，可以先拿来指导下一步探索。"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "nav-1",
          userId: "default-user",
          talentProfileId: "talent-1",
          status: "confirmed",
          confirmedAt: "2026-03-21T00:10:00.000Z",
          navigation: {
            summary: "推荐方向",
            directions: [
              {
                slug: "customer-success-and-relationship-led-roles",
                label: "客户成功、客户关系与服务推进类方向",
                rationale: "能快速建立信任，让客户、同事或合作方更愿意跟着你推进。",
                watchOut: "先拿真实岗位验证，再决定是否长期押注这个方向。",
                suggestedRoles: [
                  {
                    title: "客户成功经理",
                    jdHint: "Hint"
                  }
                ]
              }
            ],
            whyTheseDirectionsFit: ["你最容易发光的状态，是作为“梳理混乱的人”。"],
            watchOuts: ["先拿真实岗位验证，再决定是否长期押注这个方向。"]
          }
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<TalentProfileWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "确认当前优势档案" }));

    await waitFor(() => {
      expect(screen.getByText(/优势档案已保存/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "确认职业方向" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "去这个方向做岗位匹配" }).getAttribute("href")
      ).toBe("/applications/new?lane=customer-success-and-relationship-led-roles");
    });

    expect(
      screen.getByRole("link", { name: "客户成功经理" }).getAttribute("href")
    ).toBe("/applications/new?lane=customer-success-and-relationship-led-roles&role=%E5%AE%A2%E6%88%B7%E6%88%90%E5%8A%9F%E7%BB%8F%E7%90%86");
  });

  it("does not report duplicate React keys when model output contains repeated text", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TalentProfileWorkbench
        initialConfirmedCareerNavigation={{
          id: "nav-duplicate",
          userId: "default-user",
          talentProfileId: "talent-duplicate",
          status: "confirmed",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          navigation: {
            summary: "重复内容也应该稳定渲染。",
            directions: [
              {
                slug: "ai-product",
                label: "AI 产品经理",
                rationale: "适合把复杂问题讲清楚。",
                watchOut: "避免重复执行。",
                suggestedRoles: [
                  { title: "AI 产品经理", jdHint: "Hint A" },
                  { title: "AI 产品经理", jdHint: "Hint B" }
                ]
              },
              {
                slug: "ai-product",
                label: "AI 产品经理",
                rationale: "适合把复杂问题讲清楚。",
                watchOut: "避免重复执行。",
                suggestedRoles: []
              }
            ],
            whyTheseDirectionsFit: ["适合把复杂问题讲清楚。", "适合把复杂问题讲清楚。"],
            watchOuts: ["避免重复执行。", "避免重复执行。"]
          }
        }}
        initialConfirmedTalentProfile={{
          id: "talent-duplicate",
          userId: "default-user",
          status: "confirmed",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          answers: {
            discoveryMode: "radar",
            unconsciousCompetence: "我擅长把复杂问题讲清楚。",
            energyAudit: "我擅长把复杂问题讲清楚。",
            jealousySignal: "我擅长把复杂问题讲清楚。"
          },
          profile: {
            headline: "重复内容测试",
            summary: "重复内容也应该稳定渲染。",
            signals: [
              {
                key: "clarity_builder",
                label: "梳理混乱的人",
                description: "能把复杂问题讲清楚。",
                evidence: ["同一条证据", "同一条证据"]
              },
              {
                key: "clarity_builder",
                label: "梳理混乱的人",
                description: "能把复杂问题讲清楚。",
                evidence: ["同一条证据"]
              }
            ],
            workStyle: ["适合把复杂问题讲清楚。", "适合把复杂问题讲清楚。"],
            suitableDirections: ["AI 产品经理", "AI 产品经理"],
            cautionNotes: ["避免重复执行。", "避免重复执行。"],
            confidenceNote: "当前可信度为中等。"
          }
        }}
      />
    );

    const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
      call.some((value) => String(value).includes("Encountered two children with the same key"))
    );
    expect(duplicateKeyWarnings).toHaveLength(0);
  });

  it("renders a generated talent manual as readable sections", () => {
    render(
      <TalentProfileWorkbench
        initialConfirmedTalentProfile={{
          id: "talent-manual",
          userId: "default-user",
          status: "confirmed",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          answers: {
            discoveryMode: "deep",
            excavationTranscript: [
              {
                question: "什么事情让你觉得自然？",
                answer: "我会自然地把混乱信息整理成结构。",
                requiredAnchor: "unconscious_competence"
              }
            ],
            talentManual: "《个人天赋使用说明书》\n\n## 底层天赋假设\n你更擅长把混乱信息整理成结构。\n\n## 适合的工作环境\n需要处理复杂问题、协调多人推进的环境。\n\n## 不适合的工作环境\n长期重复执行。\n\n## 职业方向建议\nAI 产品经理。"
          },
          profile: {
            headline: "结构化复杂问题的人",
            summary: "能把混乱信息整理成清晰结构。",
            signals: [
              {
                key: "clarity_builder",
                label: "梳理混乱的人",
                description: "能把复杂问题讲清楚。",
                evidence: ["我会自然地把混乱信息整理成结构。"]
              }
            ],
            workStyle: ["适合处理复杂问题。"],
            suitableDirections: ["AI 产品经理"],
            cautionNotes: ["避免长期做重复执行。"],
            confidenceNote: "当前可信度为中等。",
            talentManual: "《个人天赋使用说明书》\n\n## 底层天赋假设\n你更擅长把混乱信息整理成结构。\n\n## 适合的工作环境\n需要处理复杂问题、协调多人推进的环境。\n\n## 不适合的工作环境\n长期重复执行。\n\n## 职业方向建议\nAI 产品经理。"
          }
        }}
      />
    );

    expect(screen.getByText("个人天赋使用说明书")).toBeTruthy();
    expect(screen.getByText("底层天赋假设")).toBeTruthy();
    expect(screen.getByText("你更擅长把混乱信息整理成结构。")).toBeTruthy();
    expect(screen.getByText("适合环境")).toBeTruthy();
    expect(screen.getByText("不适合环境")).toBeTruthy();
    expect(screen.getAllByText("职业方向").length).toBeGreaterThan(0);
    expect(screen.queryByText("《个人天赋使用说明书》")).toBeNull();
    expect(screen.queryByText("适合的工作环境")).toBeNull();
    expect(screen.queryByText("不适合的工作环境")).toBeNull();
    expect(screen.queryByText("职业方向建议")).toBeNull();
  });

  it("restores unsaved deep discovery turns from the local draft", async () => {
    window.localStorage.setItem(
      "offeryou:talent-excavation-draft:v1",
      JSON.stringify({
        turns: [
          {
            question: "第一轮问题",
            answer: "第一轮回答里有非常具体的经历。",
            requiredAnchor: "early_memory"
          },
          {
            question: "第二轮问题",
            answer: "第二轮回答里继续补充了能量来源。",
            requiredAnchor: "energy_audit"
          }
        ],
        profile: {
          headline: "草稿里的天赋档案",
          summary: "这是从未保存草稿恢复的内容。",
          signals: [
            {
              key: "clarity_builder",
              label: "梳理混乱的人",
              description: "能把复杂问题讲清楚。",
              evidence: ["第一轮回答里有非常具体的经历。"]
            }
          ],
          workStyle: ["适合处理复杂问题。"],
          suitableDirections: ["AI 产品经理"],
          cautionNotes: ["继续用真实岗位验证。"],
          confidenceNote: "当前可信度为中等。"
        },
        updatedAt: "2026-06-15T00:00:00.000Z"
      })
    );

    render(<TalentProfileWorkbench />);

    expect(await screen.findByText("已恢复未保存的深度填写草稿。")).toBeTruthy();
    expect(screen.getByText("已完成 2 轮回答")).toBeTruthy();
    expect(screen.getByText("草稿里的天赋档案")).toBeTruthy();
    expect(screen.getByText("第二轮回答里继续补充了能量来源。")).toBeTruthy();
  });

  it("deduplicates repeated deep discovery turns restored from a draft", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (body.action === "next_question") {
        return {
          ok: true,
          json: async () => ({
            type: "question",
            question: "成年后哪件事让你觉得自然，但别人觉得难？",
            reflection: "上一轮已经保留为一轮。",
            requiredAnchor: "unconscious_competence",
            progress: {
              current: 2,
              max: 10,
              canFinalize: false
            },
            generationMode: "model"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({ draft: {} })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TalentProfileWorkbench
        initialExcavationDraft={{
          userId: "default-user",
          updatedAt: "2026-06-15T00:00:00.000Z",
          turns: [
            {
              question: "同一个早期问题",
              answer: "同一个回答里有非常具体的经历。",
              requiredAnchor: "early_memory"
            },
            {
              question: "同一个早期问题",
              answer: "同一个回答里有非常具体的经历。",
              requiredAnchor: "early_memory"
            }
          ]
        }}
      />
    );

    expect(await screen.findByText("已完成 1 轮回答")).toBeTruthy();
    expect(screen.getAllByText("同一个回答里有非常具体的经历。")).toHaveLength(1);
    expect(await screen.findByText("成年后哪件事让你觉得自然，但别人觉得难？")).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交并继续追问" }).hasAttribute("disabled")).toBe(false);
  });

  it("keeps deep discovery fillable when the model falls back to a basic question", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: "question",
        question: "16 岁以前，在没人要求你的情况下，有哪些事情会反复去做？",
        reflection: "",
        requiredAnchor: "early_memory",
        progress: {
          current: 1,
          max: 10,
          canFinalize: false
        },
        generationMode: "deterministic_fallback",
        riskNotes: ["当前 AI 追问暂时没有返回可用问题，先用基础追问继续。"]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TalentProfileWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "深度填写" }));

    expect(await screen.findByText(/16 岁以前/)).toBeTruthy();
    expect(screen.getByText("基础追问")).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交并继续追问" }).hasAttribute("disabled")).toBe(false);
  });

  it("allows generating a talent manual after four deep turns", async () => {
    render(
      <TalentProfileWorkbench
        initialExcavationDraft={{
          userId: "default-user",
          updatedAt: "2026-06-15T00:00:00.000Z",
          turns: [
            {
              question: "早期线索是什么？",
              answer: "我很早就喜欢把混乱信息整理成结构。",
              requiredAnchor: "early_memory"
            },
            {
              question: "什么事情别人觉得难？",
              answer: "别人觉得复杂的信息整理很难，但我做起来很自然。",
              requiredAnchor: "unconscious_competence"
            },
            {
              question: "什么事情让你回血？",
              answer: "分析复杂问题并把方向讲清楚会让我更兴奋。",
              requiredAnchor: "energy_audit"
            },
            {
              question: "你羡慕哪种状态？",
              answer: "我羡慕能把复杂方向判断清楚并影响团队的人。",
              requiredAnchor: "jealousy_signal"
            }
          ]
        }}
      />
    );

    expect(await screen.findByText("已完成 4 轮回答")).toBeTruthy();
    expect(screen.getByText("可生成")).toBeTruthy();
    expect(screen.getByText("4 轮后可生成基础版，6 到 8 轮通常更稳，10 轮只是上限。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "生成天赋说明书" }).hasAttribute("disabled")).toBe(false);
  });

  it("shows manual generation progress on the manual button instead of the follow-up button", async () => {
    let resolveFinal: (value: unknown) => void = () => {};
    const finalPromise = new Promise((resolve) => {
      resolveFinal = resolve;
    });
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };

      if (body.action === "finalize") {
        return finalPromise;
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          type: "question",
          question: "如果继续追问，你还想确认什么？",
          reflection: "",
          requiredAnchor: "follow_up",
          progress: {
            current: 5,
            max: 10,
            canFinalize: true
          },
          generationMode: "deterministic_fallback"
        })
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TalentProfileWorkbench
        initialExcavationDraft={{
          userId: "default-user",
          updatedAt: "2026-06-15T00:00:00.000Z",
          turns: [
            {
              question: "早期线索是什么？",
              answer: "我很早就喜欢把混乱信息整理成结构。",
              requiredAnchor: "early_memory"
            },
            {
              question: "什么事情别人觉得难？",
              answer: "别人觉得复杂的信息整理很难，但我做起来很自然。",
              requiredAnchor: "unconscious_competence"
            },
            {
              question: "什么事情让你回血？",
              answer: "分析复杂问题并把方向讲清楚会让我更兴奋。",
              requiredAnchor: "energy_audit"
            },
            {
              question: "你羡慕哪种状态？",
              answer: "我羡慕能把复杂方向判断清楚并影响团队的人。",
              requiredAnchor: "jealousy_signal"
            }
          ]
        }}
      />
    );

    expect(await screen.findByText("已完成 4 轮回答")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "生成天赋说明书" }));

    expect(screen.getByRole("button", { name: "提交并继续追问" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "追问中..." })).toBeNull();
    expect(screen.getByRole("button", { name: "正在生成说明书..." })).toBeTruthy();

    resolveFinal({
      ok: true,
      json: async () => ({
        type: "final",
        profile: {
          headline: "你最容易发光的状态，是作为“梳理混乱的人”。",
          summary: "模型生成的天赋画像。",
          signals: [
            {
              key: "clarity_builder",
              label: "梳理混乱的人",
              description: "能把混乱信息理清。",
              evidence: ["整理了复杂信息。"]
            }
          ],
          workStyle: ["适合处理复杂问题。"],
          suitableDirections: ["AI 产品经理"],
          cautionNotes: ["继续验证。"],
          confidenceNote: "当前可信度为中等。"
        },
        talentManual: "《个人天赋使用说明书》\n\n## 底层天赋假设\n你更擅长把混乱信息整理成结构。",
        generationMode: "model"
      })
    });

    await waitFor(() => {
      expect(screen.getByText("天赋说明书已生成，可以保存为当前优势档案。")).toBeTruthy();
    });
  });

  it("shows the recommended deep discovery range before the hard limit", async () => {
    render(
      <TalentProfileWorkbench
        initialExcavationDraft={{
          userId: "default-user",
          updatedAt: "2026-06-15T00:00:00.000Z",
          turns: [
            {
              question: "早期线索是什么？",
              answer: "我很早就喜欢把混乱信息整理成结构。",
              requiredAnchor: "early_memory"
            },
            {
              question: "什么事情别人觉得难？",
              answer: "别人觉得复杂的信息整理很难，但我做起来很自然。",
              requiredAnchor: "unconscious_competence"
            },
            {
              question: "什么事情让你回血？",
              answer: "分析复杂问题并把方向讲清楚会让我更兴奋。",
              requiredAnchor: "energy_audit"
            },
            {
              question: "你羡慕哪种状态？",
              answer: "我羡慕能把复杂方向判断清楚并影响团队的人。",
              requiredAnchor: "jealousy_signal"
            },
            {
              question: "还有什么要继续追问？",
              answer: "我想确认自己更适合做前期判断还是后期推进。",
              requiredAnchor: "follow_up"
            },
            {
              question: "真实岗位里怎么验证？",
              answer: "我希望拿 AI 产品经理和策略分析类岗位去验证。",
              requiredAnchor: "follow_up"
            }
          ]
        }}
      />
    );

    expect(await screen.findByText("已完成 6 轮回答")).toBeTruthy();
    expect(screen.getByText("推荐区间")).toBeTruthy();
  });
});
