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

describe("TalentProfileWorkbench", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders a talent profile card and refreshes it from the user's answers", () => {
    render(<TalentProfileWorkbench />);

    expect(screen.getByText("优势档案")).toBeTruthy();
    expect(screen.getByRole("button", { name: "初步挖掘" })).toBeTruthy();
    expect(screen.getByText(/当前可信度/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/身体很累，但脑子反而越来越兴奋/i), {
      target: {
        value: "安静、专注、深度工作的状态会让我身体累，但脑子很兴奋，也让我想继续做下去。"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "生成优势档案" }));

    expect(screen.getByText(/需要一段相对安静、连续的思考时间/)).toBeTruthy();
  });

  it("switches into deep discovery and shows the deeper question set", () => {
    render(<TalentProfileWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "深度挖掘" }));

    expect(screen.getByText(/认真挖一次，把那些一直存在但没被命名的天赋找出来/)).toBeTruthy();
    expect(screen.getByLabelText(/16 岁以前/)).toBeTruthy();
    expect(screen.getByText("1 / 5")).toBeTruthy();
    expect(screen.getByText(/即时反思/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    expect(screen.getByLabelText(/成年后，你有什么一直以为只是常识/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    expect(screen.getByText(/系统追问方向/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "生成深度挖掘结果" })).toBeTruthy();
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
            workStyle: ["更适合有人协作、沟通频繁、能看到彼此配合的工作环境。"],
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
            summary: "这些方向更接近你优势容易放大、做起来也更可能持续有状态的工作环境。",
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
      expect(screen.getByText(/初步挖掘结果已确认/)).toBeTruthy();
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
});
