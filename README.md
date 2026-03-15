# OfferYou

### Stop applying. Start being discovered.
### 别海投了，让 Offer 来找你。

---

OfferYou is an AI-powered resume optimization assistant that goes beyond keyword matching. Through structured dialogue, it **uncovers your deep, latent talents** — the things you're naturally great at but may have never thought to highlight — then uses that insight to create sharper, more authentic CVs.

## 🧬 What Makes OfferYou Different?

### 🔮 Talent Radar (v0.1 — Available Now)
Before touching your resume, OfferYou asks you **3 precise questions** to build a Talent Profile Card. This card changes how your resume is analyzed: instead of just matching keywords, it evaluates whether a role fits your **natural energy pattern**.

### 🔬 Deep Talent Excavation (v0.2 Preview — Included)
A 30-60 minute Socratic dialogue (up to 10 questions) that produces a comprehensive **Talent Manual** — combining Gallup StrengthsFinder theory, Flow theory, and Jungian shadow work to map your foundational talents to concrete career directions.

### 🛡️ Absolute Distortion Prevention
Your resume is yours. OfferYou never fabricates achievements. Every optimization is traceable to your original data, presented side-by-side for your approval.

### 📸 Snapshot Derivation
Each tailored CV is an independent branch from your "Master Repository." Your core facts stay clean; job-specific versions are disposable snapshots.

## 👀 See It in Action

Check out the **[Career Switch Demo](examples/demo_career_switch.md)** — a sanitized real case where a banking professional transitions to an AI Product Manager role using the full OfferYou pipeline.

## 📦 Repository Structure

```
OfferYou/
├── README.md
├── SKILL.md                              # Agent execution contract
├── prompts/
│   ├── talent_radar.md                   # ⭐ 3-question talent profiling
│   ├── talent_excavation.md              # 🔬 Deep discovery (≤10 questions)
│   ├── gap_analysis.md                   # Recruiter-persona JD analysis
│   └── rewrite_expert.md                 # STAR-method optimization
├── templates/
│   ├── Talent_Profile_Card.md            # Structured talent output
│   ├── Master_Resume_Template.md         # Your "ground truth" fact library
│   └── CV_Snapshot_Template.md           # Per-job tailored output
├── examples/
│   └── demo_career_switch.md             # 📖 Real-world Before/After case
└── design/                               # Architecture preview (for devs)
    ├── api/openapi.yaml
    └── docs/MVP_Protocol.md
```

## 🚀 Quick Start

1. **Discover your talents**: Run `prompts/talent_radar.md` → get your Talent Profile Card.
2. **Build your fact library**: Fill in `templates/Master_Resume_Template.md`.
3. **Analyze a job**: Feed your master + JD + talent card into `prompts/gap_analysis.md`.
4. **Refine**: Use `prompts/rewrite_expert.md` for mentor-mode suggestions.
5. **Go deeper** (optional): Run `prompts/talent_excavation.md` for a full Talent Manual.

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| v0.1 | Job Apply Skill + **Talent Radar** (3-question profiling) | ✅ Released |
| v0.2 | Deep Talent Excavation (≤10 questions, 天赋说明书) | 🧪 Preview Included |
| v0.3 | Career Direction Recommendations based on Talent × Market | 📋 Planned |
| v1.0 | Full Platform with Talent × Role Matching Engine | 🌟 Vision |

## 🤝 Contributing
PRs welcome! Especially interested in:
- Additional talent assessment frameworks
- Localized prompt variants (languages, cultural context)
- Integration with ATS platforms

## 📜 License
MIT

---
*Part of the [OrbitOS](https://github.com/nicekid1/OrbitOS) Ecosystem. Built for Agentic Workflows.*
