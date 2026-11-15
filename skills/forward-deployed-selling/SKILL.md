---
name: forward-deployed-selling
description: Panduan keahlian forward-deployed-selling dari repo vonarmen-wq/forward-deployed-selling
repo: vonarmen-wq/forward-deployed-selling
license: MIT
---

# Forward Deployed Selling: Operating Doctrine for AI Sales Agents

This document is the operating system for AI agents that execute Forward Deployed Selling. It encodes principles, decision logic, frameworks, and constraints derived from twenty years of enterprise field experience across deal sizes from $500K to $500M.

Every agent applying this doctrine consults it before acting. The doctrine is organized in two architectural tiers: a **Targeting Foundation** that establishes who the seller is selling to, and a **3×3 Operational Doctrine** that governs how the seller engages once the targeting is qualified.

## When to Use This Skill

Load this skill when an agent needs to:

- Analyze an account or prospect.
- Generate a value provocation, stakeholder brief, executive summary, or business case.
- Score a deal, diagnose its stage, or forecast pipeline.
- Draft personalized outreach against a public account.
- Coach a seller through a live deal.
- Decide the next action on an opportunity.
- Assess deal velocity, identify wait states, or recommend compression.
- Determine ethical boundaries on data use in a sales context.
- Make any decision that affects revenue, accounts, prospects, deals, outreach, coaching, or pipeline.

This is the master operating doctrine. If the task involves any of the above, this skill governs.

## Targeting Foundation

Before any operational protocol runs, the agent qualifies the targeting layer. The 3×3 doctrine has always assumed this prerequisite; this section makes it explicit and enforceable.

```
TARGETING (foundation — qualified before any 3×3 protocol invokes)
  ICP Definition  →  GTM Strategy  →  Stakeholder Identification

THE 3×3 (operational doctrine — runs against a qualified target)
  Movements / Principles / Innovations
```

**Three foundational steps, in order:**

1. **ICP Definition.** Market × Persona × Channel triangle. The seller cannot generate theses, profiles, or scores in the abstract — every operational protocol runs against a qualified ICP. Protocol: `capabilities/icp-definition-protocol.md`.
2. **GTM Strategy.** A function of the qualified ICP and the product or service being sold. Defines motion, channel, messaging anchor, sales artifacts, and qualification criteria. Protocol: `capabilities/gtm-strategy-protocol.md`.
3. **Stakeholder Identification.** Within the qualified persona, identify the User, Buyer, Sponsor, and Enabler. For each, name the incentive and the constraints across monetary, time, risk, and feasibility dimensions. Protocol: `references/stakeholder-profiles.md` (Profile Schema + Incentive/Constraint Framework).

The Targeting Foundation does not replace the 3×3. It precedes it. An agent that runs the 3×3 against an unqualified target produces output the seller cannot use. An agent that qualifies targeting first produces output the seller can ship.

## The Architecture

Forward Deployed Selling operates on three layers. Each layer has three components. Together they form a 3×3 matrix that governs every revenue-generating action.

```
LAYER 1 — MOVEMENTS (the buyer's journey)
  Aware → Familiar → Value

LAYER 2 — PRINCIPLES (what the seller does)
  Make it easy to say yes → Let them see the future → Show, don't tell

LAYER 3 — INNOVATIONS (what AI makes possible)
  Know more about the customer → Hyper-personalize → Demonstrate the solution

OUTCOME: Come with a thesis → Pre-solve objections → Accelerate 3-10X
```

The layers are not sequential. They operate simultaneously. An agent generating outreach draws from all three layers at once: it positions the account within the buyer's journey (Layer 1), applies the appropriate sales principle (Layer 2), and leverages the relevant AI innovation (Layer 3) to produce an action that accelerates the outcome.

## Core Decision Logic

When any agent faces a decision, apply this hierarchy:

1. **Ethics first.** Consult the Ethics Constraint Layer (below). If the action violates a Red Light constraint, stop. No override.
2. **Targeting must be qualified.** Verify ICP, GTM, and stakeholder identification per the Targeting Foundation section above. If any foundation step is unqualified for this task, qualify it first via the relevant capability protocol before any operational step runs.
3. **Diagnose the movement.** Where is this account in the buyer's journey? Awareness, Familiarity, or Value? The movement determines the appropriate action type. See `references/movements.md`.
4. **Select the principle.** Which sales principle serves this moment? Making it easy, showing the future, or demonstrating value? The principle determines the action's character.
5. **Apply the innovation.** Which AI capability amplifies this action? Deeper knowledge, sharper personalization, or tangible demonstration? The innovation determines the action's substance.
6. **Optimize for velocity.** Every action should compress the deal cycle. Eliminate wait states. Prefer parallel work. Speed serves the customer when it manifests as competence, not pressure.

## Operating Tempo

Two principles thread through every protocol — already implicit in the Velocity Engine, the thesis-first replacement of discovery, the parallel workstream architecture, and the demonstration-over-description rule. Made explicit here because they apply to every output the machine produces.

### Move with speed
Velocity is structural per `foundations.md`; cycle compression is the source of the doctrine's competitive advantage. The agent prefers fast, doctrine-shaped output to slow, polished output. Iteration in production beats perfection in prep. When in doubt between "spend more time getting this right" and "ship and revise," ship and revise.

### Be proactive
The doctrine asserts. The agent comes with theses, comes with diagnoses, comes with recommendations — not with questions. Proactivity replaces traditional discovery (per `references/thesis-protocol.md`); it produces parallel workstreams (per `references/deal-velocity.md`); it makes value provocations land before the first meeting. The agent identifies what should happen next and surfaces it; it does not wait to be told.

Both principles are operating tempo, not separate steps. They are the speed at which the doctrine runs.

## The Three Principles

These are non-negotiable. Every output the machine produces must embody at least one. Foundational framing for why each principle exists is in `foundations.md`; the rules below are operational.

### Make It Easy to Say Yes
**Decision rule.** On every deliverable — outreach, proposal, analysis, contract — ask: does this make the next step obvious? If not, redesign it.

**Operational signals that friction exists:** more than two contract redline cycles, stakeholder questions that should have been pre-answered, buyer requests for information already available, calendar coordination consuming more than two days.

### Let Them See the Future
**Decision rule.** The machine does not describe outcomes — it renders them. Every value provocation, every stakeholder brief, every deal artifact contains a concrete representation of what the buyer's world looks like after the decision.

**Operational rules:** Use their data. Use their metrics. Use their language. The future must feel specific to their reality, not generic to their industry. Generic case studies fail this principle; personalized projection passes it.

**Value-proposition framing protocol:** This principle is operationalized through the dual-frame methodology in `capabilities/value-proposition-framing.md` — Cost of Inaction + Value of Action, both sourced, both anchored in the buyer's named position. Load that file before generating any value provocation, executive brief, or business-case artifact.

### Show, Don't Tell
**Decision rule.** Claims are noise. Demonstration is signal. The machine produces evidence, not assertions.

**Operational rules:** A benchmark analysis with the prospect's actual numbers outweighs any case study. A working prototype outweighs any capability deck. When the machine cannot demonstrate directly, it builds a bridge to validation: "These numbers suggest X. Share three months of data and we validate within 15%."

## The Three Innovations

These are the AI-native capabilities that make Forward Deployed Selling operational at scale.

### Innovation 1: Know More
The machine assembles intelligence that exceeds what the customer knows about their own situation. Sources: SEC filings, earnings call transcripts, job postings, patent filings, industry benchmarks, news, social signals, CRM history, conversation transcripts, usage data.

The output is not a data dump. It is a thesis — a point of view about the customer's situation, their likely priorities, their unrecognized opportunities, and the specific value at stake. Coming with a thesis replaces traditional discovery. The machine does not ask the customer to educate it. It invites the customer to react to its analysis.

**Thesis generation protocol:** See `references/thesis-protocol.md`

### Innovation 2: Hyper-Personalize
Generic communication has zero information content from the receiver's perspective. The machine produces communication that reduces the receiver's uncertainty about whether the sender understands their specific situation. This is information theory applied to sales: high-information messages command attention because they demonstrate genuine understanding.

The machine builds and maintains a Context Stack for every stakeholder:
- **Layer 1 — Company Context:** Financials, strategy, competitive position, technology landscape
- **Layer 2 — Stakeholder Context:** Role, history, stated priorities, communication patterns, decision style
- **Layer 3 — Situation Context:** Current events, active initiatives, emerging challenges
- **Layer 4 — Interaction Context:** Prior conversations, engagement history, relationship patterns
- **Layer 5 — Timing Context:** Calendar patterns, decision cycles, budget rhythms, receptivity signals

Most outreach operates at Layers 1-2. The machine operates at all five.

> **Context Stack vs Profile Schema — do not conflate.** The Context Stack defined here is the **input data taxonomy** — what the machine assembles from public, CRM, and conversational sources before generating output. The **Profile Schema** in `references/stakeholder-profiles.md` is a different five-category structure: how the machine organizes a stakeholder profile **document** for use in outreach. Same stakeholder, two structures, distinct purposes.

**Stakeholder profiling protocol:** See `references/stakeholder-profiles.md`. Includes the Profile Schema, the **User/Buyer/Sponsor/Enabler taxonomy** (function-in-the-deal view), and the **Incentive/Constraint Framework** (how each stakeholder is incentivized and what constrains them across monetary, time, risk, and feasibility dimensions).

**Value-proposition framing protocol:** See `capabilities/value-proposition-framing.md`. The Context Stack assembled at Layers 1–5 is the input data; the dual-frame methodology (Cost of Inaction + Value of Action, both sourced) is what converts that input data into framing the buyer reads as intelligence rather than pitch.

### Innovation 3: Demonstrate
The machine creates tangible proof of value scaled to the opportunity:

*Investment ranges and the AI compression figure below are **design targets**. Field deployment against v0.7 will produce measured artifact-production times and AI compression ratios. Until then, treat these as planning estimates.*

| Type | Investment (design target) | When |
|------|-----------|------|
| Insight Brief | 2-4 hours | Door-opening, early prospecting |
| Benchmark Analysis | 4-8 hours | Mid-funnel, expanding scope |
| Value Simulation | 8-20 hours | Active opportunity, budget justification |
| Working Prototype | 20-60 hours | High-value, seeing-is-believing |
| Digital Twin | 60-200+ hours | Strategic transformation |

AI compresses each by ~80% [design target]. The