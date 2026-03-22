import type { TalentProfile } from "@/lib/services/talent/talent-profile";

export type CareerDirectionSummary = {
  slug: string;
  label: string;
  rationale: string;
  watchOut: string;
  suggestedRoles: Array<{
    title: string;
    jdHint: string;
  }>;
};

export type CareerNavigationProfile = {
  summary: string;
  directions: CareerDirectionSummary[];
  whyTheseDirectionsFit: string[];
  watchOuts: string[];
};

export function buildCareerNavigation(profile: TalentProfile): CareerNavigationProfile {
  const directions = profile.suitableDirections.slice(0, 3).map((label, index) => ({
    slug: getDirectionSlug(label),
    label,
    rationale: profile.signals[index]?.description ?? profile.summary,
    watchOut: profile.cautionNotes[index] ?? profile.cautionNotes[0] ?? "先拿真实岗位验证，再决定是否长期押注这个方向。",
    suggestedRoles: getSuggestedRoles(label)
  }));

  return {
    summary:
      directions.length > 0
        ? "这些方向更接近你优势容易放大、做起来也更可能持续有状态的工作环境。"
        : "当前方向建议还比较早期，因为前面的优势画像还需要更多真实经历来支撑。",
    directions,
    whyTheseDirectionsFit: [
      profile.headline,
      ...profile.workStyle.slice(0, 2)
    ],
    watchOuts: profile.cautionNotes.slice(0, 3)
  };
}

function getSuggestedRoles(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("customer success") || normalized.includes("客户成功") || normalized.includes("客户关系")) {
    return [
      {
        title: "客户成功经理",
        jdHint:
          "这个岗位需要你能在复杂流程中带着客户往前走，快速建立信任，协调多方，并把模糊需求变成清晰行动。"
      },
      {
        title: "实施交付经理",
        jdHint:
          "这个岗位要负责客户上线和交付推进，帮助客户把不清晰的需求，变成能执行、能协同的落地方案。"
      },
      {
        title: "客户解决方案经理",
        jdHint:
          "这个岗位需要真正理解客户需求，降低协作复杂度，并稳定推动跨团队交付。"
      }
    ];
  }

  if (
    normalized.includes("operations") ||
    normalized.includes("delivery") ||
    normalized.includes("program") ||
    normalized.includes("运营") ||
    normalized.includes("交付") ||
    normalized.includes("项目推进")
  ) {
    return [
      {
        title: "项目经理",
        jdHint:
          "这个岗位需要较强的主动推进能力、结构化规划能力，以及在模糊环境里把团队重新对齐到执行上。"
      },
      {
        title: "运营负责人",
        jdHint:
          "这个岗位适合能把混乱流程整理成可复用机制、提升执行闭环，并推动多方协同的人。"
      },
      {
        title: "交付经理",
        jdHint:
          "这个岗位重点在于理清优先级、推动节奏，并确保复杂事项能稳定落地。"
      }
    ];
  }

  if (
    normalized.includes("research") ||
    normalized.includes("strategy") ||
    normalized.includes("analytical") ||
    normalized.includes("研究") ||
    normalized.includes("策略") ||
    normalized.includes("分析")
  ) {
    return [
      {
        title: "策略分析师",
        jdHint:
          "这个岗位适合能整理信息、发现规律，并把发现变成可执行建议的人。"
      },
      {
        title: "研究运营",
        jdHint:
          "这个岗位需要结构化思考、证据整理能力，以及通过清晰分析帮助团队做更好判断。"
      },
      {
        title: "洞察经理",
        jdHint:
          "这个岗位要把碎片化数据和用户信号，整理成团队真正能用的洞察。"
      }
    ];
  }

  return [
    {
      title: "合作伙伴经理",
      jdHint:
        "这个岗位需要建立外部信任关系、做好跨团队协调，并推动合作向明确结果前进。"
    },
    {
      title: "赋能负责人",
      jdHint:
        "这个岗位适合能把复杂需求转成清晰支持方案，帮助团队采用更好工作方式的人。"
    },
    {
      title: "跨团队协同伙伴",
      jdHint:
        "这个岗位处在多个团队交叉点上，需要持续降低模糊感、维持信任，并推动事情向前。"
      }
    ];
}

export function findCareerDirectionBySlug(
  navigation: { directions: CareerDirectionSummary[] } | { navigation: { directions: CareerDirectionSummary[] } } | null,
  slug: string
): CareerDirectionSummary | null {
  if (!navigation) {
    return null;
  }

  const directions = "navigation" in navigation ? navigation.navigation.directions : navigation.directions;
  return directions.find((direction) => direction.slug === slug) ?? null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDirectionSlug(label: string) {
  if (label.includes("客户成功") || label.includes("客户关系")) {
    return "customer-success-and-relationship-led-roles";
  }

  if (label.includes("运营") || label.includes("项目推进") || label.includes("交付")) {
    return "operations-program-or-delivery-roles";
  }

  if (label.includes("研究") || label.includes("策略") || label.includes("分析")) {
    return "research-strategy-or-analytical-roles";
  }

  if (label.includes("合作") || label.includes("赋能") || label.includes("跨团队")) {
    return "partnership-enablement-or-coordination-roles";
  }

  return slugify(label);
}
