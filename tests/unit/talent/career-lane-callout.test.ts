import { describe, expect, it } from "vitest";
import { getCareerLaneCallout } from "@/lib/services/talent/career-lane-callout";

describe("getCareerLaneCallout", () => {
  it("maps a selected lane to a lightweight role-matching callout", () => {
    const callout = getCareerLaneCallout({
      lane: "customer-success-and-relationship-led-roles",
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
              watchOut: "先拿真实岗位验证，再决定是否长期押注这个方向。"
            }
          ],
          whyTheseDirectionsFit: [],
          watchOuts: []
        }
      }
    });

    expect(callout).toEqual({
      laneLabel: "客户成功、客户关系与服务推进类方向",
      strengthHint: "你最容易发光的状态，是作为“建立信任的人”。",
      riskHint: "先拿真实岗位验证，再决定是否长期押注这个方向。"
    });
  });
});
