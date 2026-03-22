import { describe, expect, it } from "vitest";
import { getApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";

describe("getApplicationDraftDefaults", () => {
  it("prefills job title and jd content from the selected lane and role", () => {
    const defaults = getApplicationDraftDefaults({
      lane: "customer-success-and-relationship-led-roles",
      role: "实施交付经理",
      talentProfile: {
        id: "talent-1",
        userId: "default-user",
        status: "confirmed",
        confirmedAt: "2026-03-21T00:00:00.000Z",
        answers: {
          proudMoment: "Example",
          trustedProblem: "Example because I organize chaos.",
          energyPattern: "Example"
        },
        profile: {
          headline: "你最容易发光的状态，是作为“建立信任的人”。",
          summary: "Summary",
          signals: [],
          workStyle: [],
          suitableDirections: [],
          cautionNotes: [],
          confidenceNote: "Confidence note"
        }
      },
      careerNavigation: {
        id: "nav-1",
        userId: "default-user",
        talentProfileId: "talent-1",
        status: "confirmed",
        confirmedAt: "2026-03-21T00:00:00.000Z",
        navigation: {
          summary: "Summary",
          directions: [
            {
              slug: "customer-success-and-relationship-led-roles",
              label: "客户成功、客户关系与服务推进类方向",
              rationale: "能快速建立信任，让客户、同事或合作方更愿意跟着你推进。",
              watchOut: "先拿真实岗位验证，再决定是否长期押注这个方向。",
              suggestedRoles: [
                {
                  title: "客户成功经理",
                  jdHint: "Default JD"
                },
                {
                  title: "实施交付经理",
                  jdHint: "这个岗位要负责客户上线和交付推进，帮助客户把不清晰的需求，变成能执行、能协同的落地方案。"
                }
              ]
            }
          ],
          whyTheseDirectionsFit: [],
          watchOuts: []
        }
      }
    });

    expect(defaults.jobTitle).toBe("实施交付经理");
    expect(defaults.jdContent).toMatch(/客户上线和交付推进/);
    expect(defaults.resumeAssetRef).toBe("manual://confirmed-strengths-profile");
  });
});
