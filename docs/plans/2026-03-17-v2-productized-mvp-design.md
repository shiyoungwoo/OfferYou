# OfferYou V2 Productized MVP Design

Date: 2026-03-17
Status: Draft
Scope: Single-user Web MVP with future multi-user interfaces reserved

## 1. Purpose

OfferYou v0.1 proved the product concept at the prompt, template, and protocol level. It did not ship a runnable Web product, nor a verified PDF export pipeline. V2 turns that design MVP into a productized MVP: a working Web application that lets one user complete the full job-tailoring workflow with visible control, snapshot safety, and reliable A4 preview plus PDF export.

The primary goal is not to maximize AI sophistication. The primary goal is to make the core OfferYou workflow usable end-to-end:

1. Import resume and JD
2. Analyze fit and gaps
3. Review and accept or revise local rewrite suggestions
4. Generate an independent resume snapshot
5. Preview the snapshot as multi-page A4
6. Export PDF and record the application

## 2. Product Positioning

V2 is a single-user self-serve Web MVP. It should be built with clear seams for future multi-user SaaS expansion, but it should not pay the full complexity cost of accounts, tenant isolation, billing, or public operations in the first release.

This product is differentiated by three principles:

- Absolute Distortion Prevention: AI cannot directly invent or silently rewrite facts.
- Snapshot Derivation: each job-specific resume is an independent branch derived from the Master, not a destructive rewrite.
- Talent Discovery With User Confirmation: OfferYou does more than polish wording. It surfaces latent strengths and capability patterns, but these insights require explicit user confirmation before entering the long-term knowledge base.

## 3. Scope

### Included in V2

- Web-based workflow for one active user
- Resume import from file and manual text
- JD paste input
- Master resume creation and maintenance
- Gap analysis
- Mentor-mode rewrite suggestion review
- User feedback loop on suggestions
- Snapshot generation from accepted suggestions
- A4 multi-page preview
- PDF export
- Application record creation and history view
- One production template plus a reserved renderer interface for template two

### Explicitly Out of Scope

- Public signup and login
- Multi-user tenant management
- Billing, quotas, invitations, or collaboration
- Community features
- Advanced dashboard analytics
- Many resume templates
- Full Talent Excavation session as part of the default main flow

## 4. Success Criteria

V2 is complete only if all of the following are true:

- A user can upload a resume and paste a JD to create a new application draft.
- The system can produce fit analysis and local rewrite suggestions.
- The user can accept, reject, or request revision for each suggestion.
- Accepted suggestions can generate a snapshot without modifying the Master.
- User-supplied first-hand facts can be added to the Master only through explicit confirmation.
- User-confirmed talent insights can be stored separately from facts and reused in later analysis.
- The preview can render as stable multi-page A4 with no cut-off content.
- The exported PDF closely matches the preview.
- After export, the system records the application and its output artifacts.

## 5. Core User Flow

### 5.1 New Application

The user starts a new job application draft by:

- uploading a source resume file or choosing an existing Master
- pasting the JD
- filling company, job title, and language preference

The system stores the raw assets, creates an application draft, and starts analysis.

### 5.2 Analysis Workspace

This is the primary product surface. The page contains:

- a top progress bar showing parse, analyze, revise, snapshot, preview, export
- a left panel showing JD highlights, fit score, gaps, risk notes, and talent alignment
- a center panel showing grouped rewrite suggestion cards
- a right panel showing the current evolving snapshot preview outline

Each suggestion card supports three actions:

- Accept
- Reject
- Revise

If the user chooses Revise, the user must provide feedback. The feedback may be either expression-level guidance or new first-hand source material.

### 5.3 Snapshot Generation

Only accepted suggestion results are eligible for snapshot generation. A snapshot is built from:

- selected Master facts
- selected confirmed insights
- accepted expression changes
- template and ordering preferences

The snapshot is the source for preview, export, and application records.

### 5.4 Preview and Export

The preview page renders the exact same underlying document model used by export. The user can:

- switch between template one and the reserved template two interface
- adjust a limited set of layout controls
- inspect multi-page A4 output
- export PDF
- create the final application record

## 6. Three-Layer Knowledge Model

OfferYou must not collapse everything into a single resume text blob. V2 uses three distinct layers.

### 6.1 Fact Layer

This stores only user-confirmed first-hand facts. Facts must be objective, real, and traceable to the user's own experience or source material.

Examples:

- job titles
- projects
- responsibilities
- measurable results
- education
- certificates
- tools actually used

Rules:

- AI may help extract or reformat facts, but AI cannot create new facts.
- Facts enter the Master only after explicit user confirmation.
- Facts are reusable across future application drafts.

### 6.2 Insight Layer

This stores interpreted but reusable capability insights derived from facts. These are not hard facts. They are structured interpretations, talent patterns, or capability hypotheses.

Examples:

- strong at deconstructing messy workflows into systems
- more naturally suited to zero-to-one definition than repetitive execution
- tends to perform well in cross-functional ambiguity

Rules:

- Insights may be proposed by AI from evidence in the fact layer.
- Insights do not masquerade as facts.
- Insights require explicit user confirmation before entering the long-term Master.
- Gap analysis and rewrite generation may use confirmed insights.

### 6.3 Expression Layer

This stores job-specific presentation choices.

Examples:

- summary wording
- bullet framing
- project ordering
- emphasis changes for a target JD

Rules:

- Expression changes live inside suggestions and snapshots.
- Expression changes never directly modify Master facts.
- Accepted expression changes can be reused only through a deliberate future feature, not by default.

## 7. Master Safety Rules

V2 must preserve the cleanliness of the Master.

### 7.1 Initial Master Integrity Notice

When the user first creates or imports a Master, the system must display a clear notice:

- only provide real, first-hand, verifiable information
- do not include guesses, aspirational claims, or AI-invented achievements
- all future snapshots depend on the integrity of the Master

The user must explicitly confirm this once before continuing.

### 7.2 Separate Write Paths

The system must enforce two different write paths:

- Snapshot path: accepted suggestions affect only the current snapshot
- Master augmentation path: new fact submissions or confirmed insights may be added to the Master after explicit confirmation

### 7.3 Fact Submission Gate

When user feedback contains new source material, the system should classify it as a candidate fact submission rather than auto-merging it into the current snapshot or the Master.

Before writing it to the Master, the UI should ask for:

- fact type
- source
- whether it is first-hand and true
- whether it can be reused for future applications

### 7.4 Insight Confirmation Gate

When AI proposes a new capability insight, the UI should present it as a structured insight card, including:

- proposed insight statement
- evidence blocks used to infer it
- user actions: confirm, reject, or revise

Only confirmed insights enter the Insight Master.

## 8. Suggestion Feedback Loop

The suggestion system must support iterative refinement instead of a binary accept or reject model.

### 8.1 Suggestion Statuses

Each suggestion has one of these statuses:

- pending
- accepted
- rejected
- needs_revision

### 8.2 Feedback Types

If the user requests revision, the user can choose one of:

- too_generic
- too_aggressive
- not_my_style
- fact_inaccurate
- wrong_focus
- adding_new_fact
- custom

### 8.3 Revision Chain

Suggestions must retain lineage:

- parent suggestion id
- revision round
- user feedback type
- user feedback text

This supports repeat iteration without losing context.

### 8.4 Special Handling for New Facts

If the feedback indicates new first-hand information, the system should split the workflow:

- create a candidate fact submission item
- allow the user to confirm it for Master storage
- optionally regenerate the current suggestion using the newly confirmed fact

This is how OfferYou can deepen the user's self-knowledge without corrupting the fact base.

## 9. Pages and Interaction Model

V2 should keep the interface tight and linear.

### 9.1 Home

Purpose:

- list recent application drafts
- list recent exported applications
- provide entry points for new application and Master management

### 9.2 Master Workspace

Purpose:

- review imported resume content
- clean extracted facts
- confirm or reject candidate facts
- review and confirm talent insights

This page is the maintenance surface for the Fact Master and Insight Master.

### 9.3 New Application

Purpose:

- upload raw resume asset or select an existing Master
- input JD
- set company, title, language, target length

### 9.4 Analysis Workspace

Purpose:

- review fit score and gap analysis
- review grouped rewrite suggestions
- revise suggestions with feedback
- view snapshot outline evolving in real time

This is the flagship page.

### 9.5 Preview and Export

Purpose:

- inspect the final document in multi-page A4
- toggle template and limited layout controls
- export PDF
- create final application record

### 9.6 Application Detail

Purpose:

- review the JD
- inspect accepted suggestions
- reopen the exported snapshot
- see output artifacts and timestamps

## 10. Data Model

The exact schema can evolve during implementation, but these entities should exist from day one.

### 10.1 Asset Tables

- `resume_asset`
  - id
  - user_id nullable for MVP default user
  - asset_type: resume_source | jd_source | export_pdf | export_docx | other
  - storage_path
  - mime_type
  - original_filename
  - extracted_text
  - created_at

### 10.2 Master Tables

- `master_resume`
  - id
  - user_id nullable
  - title
  - integrity_notice_confirmed_at
  - created_at
  - updated_at

- `resume_block`
  - id
  - master_resume_id
  - block_type: summary | experience | project | education | skill | certificate | other
  - raw_text
  - normalized_text
  - structured_json
  - evidence_asset_id nullable
  - status: pending_confirmation | confirmed | rejected | archived
  - created_at
  - updated_at

- `master_insight`
  - id
  - master_resume_id
  - title
  - insight_text
  - evidence_block_ids json
  - origin: ai_inferred | user_provided
  - status: pending_confirmation | confirmed | rejected
  - created_at
  - updated_at

### 10.3 Application Flow Tables

- `job_application_draft`
  - id
  - user_id nullable
  - master_resume_id
  - jd_asset_id
  - company
  - job_title
  - language
  - status
  - stage
  - fit_score nullable
  - analysis_json nullable
  - created_at
  - updated_at

- `rewrite_suggestion`
  - id
  - application_draft_id
  - target_block_id nullable
  - parent_suggestion_id nullable
  - revision_round
  - before_text
  - after_text
  - reason_text
  - evidence_refs_json
  - status
  - user_feedback_type nullable
  - user_feedback_text nullable
  - created_at
  - updated_at

- `candidate_fact_submission`
  - id
  - application_draft_id
  - related_suggestion_id nullable
  - submission_text
  - fact_type
  - source_type
  - truth_confirmed boolean
  - reusable_for_master boolean
  - status: pending_confirmation | confirmed | rejected
  - created_at
  - updated_at

- `resume_snapshot`
  - id
  - application_draft_id
  - template_key
  - document_json
  - page_estimate nullable
  - created_at
  - updated_at

- `application_record`
  - id
  - application_draft_id
  - snapshot_id
  - export_asset_id nullable
  - company
  - job_title
  - applied_at
  - notes nullable
  - created_at

## 11. State Model

At the workflow level, the draft should move through these stages:

- intake
- parsing
- analysis_ready
- revising
- snapshot_ready
- preview_ready
- export_running
- export_ready
- completed
- failed

Important transitions:

- `analysis_ready -> revising`
- `revising -> snapshot_ready`
- `snapshot_ready -> preview_ready`
- `preview_ready -> export_running -> export_ready`
- `export_ready -> completed`

The UI should never imply that the Master is being modified when only snapshot state is changing.

## 12. Technical Architecture

### 12.1 Application Stack

- Next.js App Router
- TypeScript
- Prisma
- SQLite initially, with clean migration path to Postgres
- Local filesystem storage adapter initially, with replaceable storage interface

### 12.2 Internal Modules

Keep implementation boundaries clear even inside one repo:

- `ingestion`
  - file upload
  - text extraction
  - raw asset persistence
- `master`
  - fact block management
  - insight management
  - confirmation gates
- `analysis`
  - fit scoring
  - gap analysis
  - rewrite suggestion generation
- `snapshot`
  - compose final document model from accepted changes
- `export`
  - render HTML
  - render multi-page preview
  - generate PDF

### 12.3 Sync and Async Execution Model

V2 uses a mixed execution model.

Synchronous operations:

- draft creation
- basic parsing result return
- lightweight gap analysis
- suggestion action submission

Asynchronous operations:

- heavy parsing or OCR
- expensive rewrite regeneration
- snapshot rebuild when large
- PDF generation

This keeps the UI responsive while preserving a simple architecture.

## 13. Preview and PDF Strategy

This is a top-priority architectural decision.

V2 must use:

- internal `ResumeDocument` JSON as the canonical document model
- HTML plus CSS as the canonical layout source
- headless browser PDF generation from the exact same HTML used in preview

Rules:

- preview and export must share the same renderer
- the product must not maintain separate preview and print templates
- section headings and bullet groups should avoid ugly page breaks
- the system should estimate page count before export
- the system should surface overflow warnings before PDF generation

Template strategy:

- `template_a`: implemented in V2
- `template_b`: interface reserved, basic placeholder allowed

## 14. API and Interface Boundaries

Although V2 is single-user, the internal service boundaries should assume future user scoping.

Reserve the following concerns in repositories and service interfaces:

- user context
- storage provider
- analysis provider
- export provider
- job runner

Do not hardcode single-user assumptions into database queries or file paths. The runtime may supply a default user for MVP, but interfaces should already accept user scope.

## 15. Development Phases

### Phase 1: Foundation

- set up app shell
- set up Prisma schema
- set up storage adapter
- create routes and base layouts
- implement draft creation flow

### Phase 2: Master and Analysis

- import raw resume
- extract candidate fact blocks
- build Master Workspace
- implement gap analysis
- implement suggestion cards and actions

### Phase 3: Snapshot and Preview

- build snapshot composer
- build `ResumeDocument` JSON
- implement template A HTML renderer
- implement multi-page A4 preview

### Phase 4: Export and Records

- implement PDF generation
- persist export asset
- create application record
- finalize detail page

## 16. Acceptance Checks

Before V2 is considered usable, verify all of the following:

- imported raw assets can be traced from draft to export
- confirmed Master facts remain unchanged after any snapshot actions
- new facts require explicit confirmation before entering the Master
- new insights require explicit confirmation before entering the Insight Master
- a user can request revision on any suggestion and receive a new revision chain entry
- a suggestion with expression-only feedback does not create Master writes
- a suggestion with new-fact feedback can create a fact submission and then regenerate
- preview and PDF match on layout, section order, and page count within acceptable tolerance
- exported PDFs contain no clipped or missing sections

## 17. Main Risks

- overinvesting in AI sophistication before the product workflow is solid
- letting inferred insights pollute the fact base
- building preview and PDF export as separate systems
- treating the resume as one giant text blob rather than structured blocks
- allowing user feedback to bypass Master confirmation gates

## 18. Immediate Next Step

The next artifact after this design should be a concrete implementation plan that maps the product into:

- repository structure
- Prisma schema
- route map
- first-pass component list
- service module list
- milestone-by-milestone build order
