# OfferYou

### Stop applying. Start being discovered.
### 别海投了，让 Offer 来找你。

---

OfferYou is now a runnable Web MVP for AI-assisted resume tailoring. It combines a fact-safe Master workspace, mentor-mode rewrite review, snapshot generation, A4 preview, and PDF export in one product flow.

## What This Repo Contains

This repository now includes both:

- the original prompt/template assets for talent discovery and JD alignment
- a runnable Next.js product MVP under the same repo

The current MVP supports:

- creating a job application draft from JD + resume source
- deterministic gap analysis and seed suggestions
- accept / reject / revise suggestion actions
- pending fact submission review in Master
- snapshot generation without polluting the Master
- A4-style preview rendering
- PDF export
- application record creation

## Current Product Flow

1. Open `/applications/new`
2. Create a draft with company, role, JD, and resume source
3. Review the analysis workspace at `/applications/[draftId]`
4. Accept, reject, or revise suggestions
5. Generate a snapshot
6. Open `/applications/[draftId]/preview`
7. Export PDF
8. Review the resulting record at `/applications/[draftId]/record`

## Core Product Principles

### Absolute Distortion Prevention
OfferYou does not silently invent facts. Suggestions are reviewed explicitly before they affect a snapshot.

### Snapshot Derivation
Each tailored resume is produced as an independent snapshot. The source Master stays clean.

### Fact Layer vs Insight Layer
The product distinguishes between:

- first-hand facts
- AI-surfaced but user-confirmed insights
- job-specific expression changes

### Fact Review Queue
If the user adds new raw source material during suggestion revision, it enters a pending fact review queue instead of going straight into the Master.

## Local Development

Requirements:

- Node 22+
- pnpm
- sqlite3 CLI available on the machine
- Playwright browsers installed locally for PDF export verification

Install:

```bash
pnpm install
```

Run:

```bash
pnpm dev
```

Build:

```bash
pnpm build
```

Test:

```bash
pnpm test
```

## Data Storage

The MVP currently uses a local SQLite file at `storage/offeryou.sqlite` for core product entities:

- workspace drafts
- snapshots
- application records

Uploaded/exported assets still live under the local `storage/` directory.

`prisma/schema.prisma` remains in the repo as the target long-term schema, but runtime persistence is currently stabilized with a direct SQLite adapter because Prisma engine generation is environment-sensitive in this workspace.

## Repository Structure

```
OfferYou/
├── app/                                  # Next.js App Router pages and API routes
├── components/                           # Product UI
├── lib/                                  # Services, storage, export, document model
├── prisma/                               # Target schema for future Prisma adoption
├── prompts/                              # Original prompt assets
├── templates/                            # Original resume/talent templates
├── design/                               # Earlier protocol and API design docs
├── docs/plans/                           # V2 design and implementation plans
└── tests/                                # Unit and integration coverage
```

## Verification Status

At the time of the latest MVP update:

- `pnpm build` passes
- unit/integration test suite passes
- PDF export has been verified in this environment with elevated browser permission

## Roadmap

Near-term follow-up work:

- replace the temporary deterministic analysis layer with model-backed analysis
- move remaining Master entities fully into SQLite-backed persistence
- add richer pagination and template B
- add dashboard-level application record history

## Legacy Assets

The original prompt-driven OfferYou assets are still present and still useful:

- `prompts/talent_radar.md`
- `prompts/talent_excavation.md`
- `prompts/gap_analysis.md`
- `prompts/rewrite_expert.md`
- `templates/*`
- `examples/demo_career_switch.md`

## License

MIT
