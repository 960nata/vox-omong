---
name: prd-development
description: Panduan keahlian prd-development dari repo deanpeters/Product-Manager-Skills
repo: deanpeters/Product-Manager-Skills
license: MIT
---

## Purpose
Guide product managers through structured PRD (Product Requirements Document) creation by orchestrating problem framing, user research synthesis, solution definition, and success criteria into a cohesive document. Use this to move from scattered notes and Slack threads to a clear, comprehensive PRD that aligns stakeholders, provides engineering context, and serves as a source of truth—avoiding ambiguity, scope creep, and the "build what's in my head" trap.

This is not a waterfall spec—it's a living document that captures strategic context, customer problems, proposed solutions, and success criteria, evolving as you learn through delivery.

## Input

**Works best with:** The feature or initiative the PRD covers.
**Also useful:** Discovery notes, problem statements, user research, success metrics, and constraints — paste whatever exists; the workflow slots it into the right phases and skips what's already answered.

Anything supplied with the invocation itself — text after the skill name, a pasted context dump, or an appended `ARGUMENTS:` line — counts as answers already given. Use it and skip whatever it covers; don't re-ask.

**Arriving empty-handed? That works too.** The workflow starts at problem definition and builds up from there.

**Example invocation:** `Build a PRD for self-serve workspace provisioning — here are my discovery notes and the OKR it ladders to.`

## Key Concepts

### What is a PRD?

A PRD (Product Requirements Document) is a structured document that answers:
1. **What problem are we solving?** (Problem statement)
2. **For whom?** (Target users/personas)
3. **Why now?** (Strategic context, business case)
4. **What are we building?** (Solution overview)
5. **How will we measure success?** (Metrics, success criteria)
6. **What are the requirements?** (User stories, acceptance criteria, constraints)
7. **What are we NOT building?** (Out of scope)

### PRD Structure (Standard Template)

```markdown
# [Feature/Product Name] PRD

## 1. Executive Summary
- One-paragraph overview (problem + solution + impact)

## 2. Problem Statement
- Who has this problem?
- What is the problem?
- Why is it painful?
- Evidence (customer quotes, data, research)

## 3. Target Users & Personas
- Primary persona(s)
- Secondary persona(s)
- Jobs-to-be-done

## 4. Strategic Context
- Business goals (OKRs)
- Market opportunity (TAM/SAM/SOM)
- Competitive landscape
- Why now?

## 5. Solution Overview
- High-level description
- User flows or wireframes
- Key features

## 6. Success Metrics
- Primary metric (what we're optimizing for)
- Secondary metrics
- Targets (current → goal)

## 7. User Stories & Requirements
- Epic hypothesis
- User stories with acceptance criteria
- Edge cases, constraints

## 8. Out of Scope
- What we're NOT building (and why)

## 9. Dependencies & Risks
- Technical dependencies
- External dependencies (integrations, partnerships)
- Risks and mitigations

## 10. Open Questions
- Unresolved decisions
- Areas requiring discovery
```

### Why This Works
- **Alignment:** Ensures everyone (PM, design, eng, stakeholders) understands the "why"
- **Context preservation:** Captures research and strategic rationale for future reference
- **Decision log:** Documents what's in scope, out of scope, and why
- **Execution clarity:** Provides engineering with user stories and acceptance criteria

### Anti-Patterns (What This Is NOT)
- **Not a detailed spec:** PRDs frame the problem and solution; they don't specify UI pixel-by-pixel
- **Not waterfall:** PRDs evolve as you learn; they're not frozen contracts
- **Not a substitute for collaboration:** PRDs complement conversation, not replace it

### When to Use This
- Starting a major feature or product initiative
- Aligning cross-functional teams on scope and requirements
- Documenting decisions for future reference
- Onboarding new team members to a project

### When NOT to Use This
- For small bug fixes or trivial features (overkill)
- When problem and solution are already clear and aligned (just write user stories)
- For continuous discovery experiments (use Lean UX Canvas instead)

---

### Facilitation Source of Truth

When running this workflow as a guided conversation, use [`workshop-facilitation`](../workshop-facilitation/SKILL.md) as the interaction protocol.

It defines:
- session heads-up + entry mode (Guided, Context dump, Best guess)
- one-question turns with plain-language prompts
- progress labels (for example, Context Qx/8 and Scoring Qx/5)
- interruption handling and pause/resume behavior
- numbered recommendations at decision points
- quick-select numbered response options for regular questions (include `Other (specify)` when useful)

This file defines the workflow sequence and domain-specific outputs. If there is a conflict, follow this file's workflow logic.

## Application

Use `template.md` as the fill-in document. The template includes:

- **Per-section coaching blocks** — each section has its own Instructions, Steps, Contributing Skills, and Activities so the template is self-guiding even without this workflow.
- **Inline gap tagging** — tag every gap as 🔶 **Assumption** (plausible but unvalidated) or 🔵 **Open Question** (unknown, needs discovery). Tag inline where the gap appears, not just at the end.
- **Cross-section recommendation prompts** — after completing each section, a "Before moving on" block checks consistency with prior sections and warns about what the next section will need.
- **Self-assessment** — after Section 10, a diagnostic captures the strongest section, weakest section, top assumptions to validate, and the recommended next step before sharing the PRD.
- **Skill cross-reference table** — maps 15 skills to the specific sections they feed (e.g., `problem-framing-canvas` → Section 2, `epic-breakdown-advisor` → Section 7).

This workflow orchestrates **8 phases** over **2-4 days**, using multiple component and interactive skills. The phases below describe the facilitation sequence; the template captures the output.

---

## Phase 1: Executive Summary (30 minutes)

**Goal:** Write a one-paragraph overview for skimmers.

### Activities

**1. Draft Executive Summary**
- **Format:** "We're building [solution] for [persona] to solve [problem], which will result in [impact]."
- **Example:**
  > "We're building a guided onboarding checklist for non-technical small business owners to solve the problem of 60% drop-off in the first 24 hours due to lack of guidance, which will increase activation rate from 40% to 60% and reduce churn by 10%."

- **Participants:** PM
- **Duration:** 30 minutes
- **Output:** One-paragraph summary

**Tip:** Write this first (forces clarity), but refine it last (after other sections are complete).

---

## Phase 2: Problem Statement (60 minutes)

**Goal:** Frame the customer problem with evidence.

### Activities

**1. Write Problem Statement**
- **Use:** `skills/problem-statement/SKILL.md` (component)
- **Input:** Discovery insights from `skills/discovery-process/SKILL.md` or `skills/problem-framing-canvas/SKILL.md`
- **Participants:** PM
- **Duration:** 30 minutes
- **Output:** Structured problem statement

**Example Problem Statement:**

```markdown
## 2. Problem Statement

### Who has this problem?
Non-technical small business owners (solopreneurs, 1-10 employees) who sign up for our SaaS product.

### What is the problem?
60% of users abandon onboarding within the first 24 hours because they don't know what to do first. They see an empty dashboard with no guidance, get overwhelmed by options, and leave.

### Why is it painful?
- **User impact:** Wastes time (30-60 min trying to figure out product), never reaches "aha moment," churns before experiencing value
- **Business impact:** 60% activation rate → high churn, low LTV, poor word-of-mouth

### Evidence
- **Interviews:** 8/10 churned users said "I didn't know what to do first" (discovery interviews, Feb 2026)
- **Analytics:** 60% of signups complete 0 actions within 24 hours (Mixpanel, Jan 2026)
- **Support tickets:** "How do I get started?" is #1 support question (350 tickets/month)
- **Customer quote:** "I logged in, saw an empty dashboard, and thought 'now what?' I gave up and went back to my spreadsheet."
```

**2. Add Supporting Context (Optional)**
- **Customer journey map:** If problem spans multiple touchpoints
- **Use:** `skills/customer-journey-mapping-workshop/SKILL.md` output
- **Jobs-to-be-done:** If motivations are key
- **Use:** `skills/jobs-to-be-done/SKILL.md` output

### Outputs from Phase 2

- **Problem statement:** Who, what, why, evidence
- **Supporting artifacts:** Journey map, JTBD (if relevant)

---

## Phase 3: Target Users & Personas (30 minutes)

**Goal:** Define who you're building for.

### Activities

**1. Document Personas**
- **Use:** `skills/proto-persona/SKILL.md` (component) output
- **Participants:** PM
- **Duration:** 30 minutes
- **Format:** Include persona name, role, goals, pain points, behaviors

**Example:**

```markdown
## 3. Target Users & Personas

### Primary Persona: Solo Entrepreneur Sam
- **Role:** Freelance consultant, solopreneur
- **Company size:** 1 person (no IT support)
- **Tech savviness:** Low (uses email, spreadsheets, basic SaaS)
- **Goals:** Get value from software fast without technical expertise
- **Pain points:** Overwhelmed by complex UIs, no time to watch tutorials, needs immediate value
- **Current behavior:** Signs up for products, tries for 1 day, churns if not immediately useful

### Secondary Persona: Small Business Owner (5-10 employees)
- **Role:** Owner-operator, manages team
- **Needs:** Onboard team members quickly
- **Differs from primary:** More tolerant of complexity, willing to invest setup time
```

### Outputs from Phase 3

- **Primary persona:** Detailed profile
- **Secondary personas:** (if applicable)

---

## Phase 4: Strategic Context (45 minutes)

**Goal:** Explain why this matters to the business and why now.

### Activities

**1. Document Business Goals**
- **Source:** Company OKRs, strategic memos, roadmap
- **Format:** Link feature to business outcomes
- **Example:**
  > "This initiative supports our Q1 OKR: Reduce churn from 15% to 8%. Improving onboarding activation directly impacts retention."

**2. Size Market Opportunity (Optional)**
- **Use:** `skills/tam-sam-som-calculator/SKILL.md` (interactive) output
- **When:** For major initiatives, new products, exec presentations
- **Example:**
  > "TAM: 50M small businesses globally. SAM: 5M using SaaS tools. SOM: 500K solopreneurs in our target segments. Improving onboarding could unlock 30% of SAM (1.5M potential customers)."

**3. Document Competitive Landscape (Optional)**
- **Source:** Competitor research, G2/Capterra reviews
- **Example:**
  > "Competitors (Competitor A, B) have guided onboarding. Our lack of guidance is cited as a churn reason in exit surveys."

**4. Explain "Why Now?"**
- **Rationale:** Why prioritize this now vs. later?
- **Example:**
  > "Churn spiked 15% in Q4. Onboarding is the #1 driver (60% churn in first 30 days). Fixing this is critical to hitting retention OKR."

### Outputs from Phase 4

- **Business goals:** OKRs or strategic initiatives
- **Market opportunity:** TAM/SAM/SOM (if applicable)
- **Competitive context:** How competitors address this
- **Why now:** Urgency rationale

---

## Phase 5: Solution Overview (60 minutes)

**Goal:** Describe what you're building (high-level, not detailed spec).

### Activities

**1. Write Solution Description**
- **Format:** High-level overview, 2-3 paragraphs
- **Example:**

```markdown
## 5. Solution Overview

We're building a **guided onboarding checklist** that walks new users through core workflows step-by-step when they first log in.

**How it works:**
1. User signs up and logs in for the first time
2. Modal appears: "Let's get you set up! Complete these 3 steps to get started."
3. Checklist shows:
   - ☐ Create your first project
   - ☐ Invite a teammate (optional)
   - ☐ Complet