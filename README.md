# OfferYou

### Stop applying. Start being discovered.
### 别海投了，让 Offer 来找你。

---

OfferYou is an AI-powered resume optimization assistant that goes beyond keyword matching. Through structured dialogue, it **uncovers your deep, latent talents** — then uses that insight to create sharper, more authentic CVs.

## 🧬 What Makes OfferYou Different?

### 🔮 Talent Radar
Before touching your resume, OfferYou asks **3 precise questions** to build a Talent Profile Card. This card changes how your resume is analyzed: instead of just matching keywords, it evaluates whether a role fits your **natural energy pattern**.

### 🔬 Deep Talent Excavation
A 30-60 minute Socratic dialogue (up to 10 questions) that produces a comprehensive **Talent Manual** — combining Gallup StrengthsFinder theory, Flow theory, and Jungian shadow work to map your foundational talents to concrete career directions.

### 🛡️ Absolute Distortion Prevention
Your resume is yours. OfferYou never fabricates achievements. Every optimization is traceable to your original data, presented side-by-side for your approval.

### 📸 Snapshot Derivation
Each tailored CV is an independent snapshot from your "Master Repository." Your core facts stay clean; job-specific versions are disposable.

### 📐 Three-Layer Data Model
| Layer | What It Holds | Who Controls It |
|-------|--------------|----------------|
| **Fact** | First-hand experiences | You — only verified facts enter Master |
| **Insight** | Talents, competency patterns | AI proposes, you confirm |
| **Expression** | JD-specific wording & emphasis | Per-application, disposable |

## 👀 See It in Action

Check out the **[Career Switch Demo](examples/demo_career_switch.md)** — a sanitized real case where a banking professional transitions to an AI Product Manager role using the full OfferYou pipeline (Agent Mode).

## 🚀 Quick Start

### Web Mode (Recommended)
```bash
pnpm install && pnpm dev
```
Then open `http://localhost:3000`:
- `/talent` — Discover your talents (Talent Radar + Deep Excavation)
- `/applications/new` — Create a job-specific draft
- `/me` — Your dashboard: talents, facts, applications

### Agent Mode (Prompt-Driven)
Use the prompts directly with any AI assistant:
1. `prompts/talent_radar.md` → Talent Profile Card
2. `prompts/gap_analysis.md` → JD match analysis
3. `prompts/rewrite_expert.md` → Mentor-mode suggestions
4. `prompts/talent_excavation.md` → Deep talent discovery

## 📦 Repository Structure

```
OfferYou/
├── app/                                  # Next.js App Router (pages + API)
├── components/                           # Product UI components
├── lib/                                  # Services, storage, document model
├── prompts/                              # Core AI Prompts
│   ├── talent_radar.md                   # ⭐ 3-question talent profiling
│   ├── talent_excavation.md              # 🔬 Deep discovery (≤10 questions)
│   ├── gap_analysis.md                   # Recruiter-persona JD analysis
│   └── rewrite_expert.md                 # STAR-method optimization
├── templates/                            # Resume & talent card templates
├── examples/                             # Agent Mode demo cases
├── design/                               # Architecture preview (API specs)
├── docs/plans/                           # Product design & implementation plans
├── prisma/                               # Target schema (future Prisma adoption)
├── tests/                                # Unit and integration tests
├── SKILL.md                              # Agent execution contract
└── README.md                             # You are here
```

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| v0.1 | Job Apply Skill + Talent Radar (Prompt-driven) | ✅ Released |
| v2.0 | Web MVP: Analysis → Suggestions → Snapshot → PDF Export | ✅ Running |
| v3.0 | Talent Discovery in Web UI + `/me` Dashboard | ✅ Running |
| v3.x | Demo Hardening (Create Draft fix, seed cleanup, fact confirm) | 🔧 In Progress |
| v4.0 | Model-backed analysis (replace deterministic layer) | 📋 Planned |
| v5.0 | Full SaaS: Multi-user, auth, career matching engine | 🌟 Vision |

## 🛠️ Development

```bash
pnpm install    # Install dependencies
pnpm dev        # Start development server
pnpm build      # Production build
pnpm test       # Run test suite
```

**Requirements**: Node 22+, pnpm, sqlite3 CLI

## 🤝 Contributing
PRs welcome! Especially interested in:
- Model-backed analysis implementations
- Additional talent assessment frameworks
- Localized prompt variants
- ATS platform integrations

## 📜 License
MIT

---
*Part of the [OrbitOS](https://github.com/nicekid1/OrbitOS) Ecosystem. Built for Agentic Workflows.*
