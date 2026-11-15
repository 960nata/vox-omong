---
name: strategic-planning
description: Panduan keahlian strategic-planning dari repo ognjengt/founder-skills
repo: ognjengt/founder-skills
license: MIT
---

# Strategic Planning

## Purpose
Analyze the founder's business and current situation to deliver 3 specific, actionable next moves that will drive measurable results in marketing or sales.

---

## Execution Logic

**Check $ARGUMENTS first to determine execution mode:**

### If $ARGUMENTS is empty or not provided:
Respond with:
"strategic-planning loaded, proceed with additional details about your current situation or business goals"

Then wait for the user to provide their requirements in the next message.

### If $ARGUMENTS contains content:
Proceed immediately to Task Execution (skip the "loaded" message).

---

## Task Execution

When user requirements are available (either from initial $ARGUMENTS or follow-up message):

### 1. Read Business Context
Check if `FOUNDER_CONTEXT.md` exists in the project root.
- **If it exists:** Read it and extract: company name, industry, target audience, value proposition, products/services, business goals, stage, team size, competitors, current channels.
- **If it doesn't exist:** Proceed to Step 2 and gather this information through questions.

### 2. Diagnose Current Situation
Evaluate whether you have enough information to produce high-confidence, actionable strategies:

**Required information to proceed without questions:**
- What the business does (product/service)
- Who they serve (ICP/target audience)
- Current revenue stage (pre-revenue, $X MRR/ARR, etc.)
- Primary growth goal (more leads, higher conversion, retention, etc.)
- Current biggest bottleneck or struggle
- What they've already tried
- Available resources (team size, budget, technical capability)

**If you have enough context:** Proceed directly to Step 4.

**If critical information is missing:** Proceed to Step 3.

### 3. Ask Diagnostic Questions (When Needed)
Use the AskUserQuestion tool to gather missing information. Ask between 3-10 questions based on what's needed:

**Core diagnostic questions:**
- What's your biggest struggle in the business right now?
- What have you already tried to solve this?
- What's your current main bottleneck preventing growth?
- How are you currently getting clients/customers?
- What's working? What's not working?
- What resources do you have available (budget, team, time)?
- What's your timeline for seeing results?

**Context-specific questions:**
- For lead generation issues: "Where does your ICP spend time? What conferences, communities, or platforms?"
- For conversion issues: "At what stage do prospects drop off? What objections do they have?"
- For retention issues: "Why do customers churn? Have you asked them?"
- For scaling issues: "What breaks when you try to grow? What's the constraint?"

**IMPORTANT:** Only ask questions for information you truly need. Don't ask for information you can infer from FOUNDER_CONTEXT.md or the user's initial message.

### 4. Analyze and Identify Opportunities
Based on the context gathered, analyze:

1. **Current state:** Where they are now (revenue, channels, constraints)
2. **Desired state:** Where they want to be (goals from FOUNDER_CONTEXT or questions)
3. **Gap analysis:** What's blocking them from getting there
4. **Leverage points:** Where small actions create outsized results
5. **Quick wins vs. long-term moves:** Balance immediate impact with sustainable growth

**Critical analysis principles:**
- Identify the ONE constraint that, if removed, would unlock the most growth
- Look for underutilized assets (audience, content, network, product features)
- Find competitive gaps (what competitors aren't doing that would work)
- Spot channel-market fit mismatches (selling in wrong places)
- Detect execution issues vs. strategy issues

### 5. Generate 3 Next Moves
Create exactly 3 strategic moves, ranked by impact:

**Selection criteria:**
- **Impact:** Will this measurably move the needle? (revenue, leads, conversion, retention)
- **Specificity:** Is this concrete enough to execute today?
- **Feasibility:** Can they actually do this with current resources?
- **Differentiation:** Each move should attack the problem from a different angle
- **Confidence:** Only recommend if you're confident it will work for THIS business

**For each move, write:**

**Part A — The Strategy (What & Why)**
- One-line strategy name
- 2-3 sentences explaining WHAT to do and WHY it will work for this specific business
- Reference the real constraint or opportunity it addresses

**Part B — The Exact Playbook (How)**
- Step-by-step execution plan with specific actions
- Use their actual company name, product, ICP, and industry
- Include concrete details: which platforms, which conferences, which messaging, which metrics to track
- Specify timeline and expected results

**Part C — First Action (Do This Today)**
- One specific task they can complete in the next 30-60 minutes
- Concrete enough that there's no ambiguity about what to do

### 6. Format and Verify
- Structure output according to **Output Format** section
- Complete **Quality Checklist** self-verification before presenting output

---

## Writing Rules
Hard constraints. No interpretation.

### Core Rules
- Zero generic advice. Every recommendation must be specific to THIS business.
- Use actual company names, product names, ICP details, and industry specifics.
- Lead with the highest-impact move first.
- Every strategy must include a concrete playbook, not just a concept.
- Specify metrics to track for each move.
- No motivational fluff. Only actionable strategy.
- Active voice only.
- Strategies must be executable within their resource constraints.

### Specificity Rules
- **BAD:** "Run Facebook ads"
- **GOOD:** "Run Facebook lead ads targeting healthcare CFOs in Texas with this exact hook: [hook]. Budget: $500/month. Track: cost per qualified lead. Goal: 15 leads in 30 days."

- **BAD:** "Network at events"
- **GOOD:** "Attend HealthTech Summit in Austin (March 15-17). Book a booth ($2,500). Approach 30 attendees with your value proposition. Collect LinkedIn profiles. Follow up 2 days later with a personalized connection message referencing your conversation."

- **BAD:** "Improve your website"
- **GOOD:** "Add a self-serve product demo at try.yourcompany.com. No signup required. Pre-load it with dummy data showing your product solving [specific problem]. Add CTA at end: 'Want this for your team? Start free trial.' Track: demo completion rate, demo-to-trial conversion."

### Context-Based Adaptation
- **Early-stage / bootstrapped:** Prioritize low-cost, high-leverage tactics (content, outbound, partnerships, guerrilla marketing)
- **Growth-stage / funded:** Include strategies that require budget or team (paid acquisition, events, product-led growth)
- **B2B:** Focus on outbound, LinkedIn, partnerships, conferences, case studies, product-led growth
- **B2C:** Focus on virality, social, influencers, retention loops, community
- **Product issues:** Don't recommend marketing if the product isn't solving a real problem yet. Recommend customer development instead.
- **Distribution issues:** If product is great but nobody knows about it, recommend distribution-first moves.

### Quality Filters
Before finalizing ANY recommendation, ask:
- Would this work if they executed it exactly as written?
- Is this specific enough that they could start in the next hour?
- Does this leverage their unique position, audience, or assets?
- Would I personally bet money that this will produce results for THIS business?
- If the answer to any is "no" → rewrite or replace the recommendation.

---

## Output Format

```markdown
## Your 3 Next Moves

Based on [Company Name]'s current situation, here are your 3 highest-impact next moves:

---

### Move 1: [Strategy Name]

**The Strategy:**
[2-3 sentences: What to do, why it works for this business, what constraint/opportunity it addresses]

**The Exact Playbook:**

**Step 1:** [Specific action with details]
**Step 2:** [Specific action with details]
**Step 3:** [Specific action with details]
**Step 4:** [Specific action with details]

**Metrics to Track:**
- [Specific metric 1]
- [Specific metric 2]
- [Specific metric 3]

**Expected Results:**
[Concrete outcome with timeline, e.g., "15-20 qualified leads within 30 days"]

**Do This Today:**
[One 30-60 minute action they can take immediately]

---

### Move 2: [Strategy Name]

**The Strategy:**
[...]

**The Exact Playbook:**
[...]

**Metrics to Track:**
[...]

**Expected Results:**
[...]

**Do This Today:**
[...]

---

### Move 3: [Strategy Name]

**The Strategy:**
[...]

**The Exact Playbook:**
[...]

**Metrics to Track:**
[...]

**Expected Results:**
[...]

**Do This Today:**
[...]

---

## Execution Priority

**Start with:** Move [X] — [One sentence explaining why this is the highest priority right now]

**Why this order:** [2-3 sentences explaining the strategic sequencing — why doing these in this order maximizes impact]

---

## Success Criteria

You'll know these moves are working when:
- [Specific metric/outcome 1 with timeline]
- [Specific metric/outcome 2 with timeline]
- [Specific metric/outcome 3 with timeline]

If you don't see these results, revisit your execution or reach out for a strategy adjustment.
```

**Example:**

```markdown
## Your 3 Next Moves

Based on CalendarAI's current situation (early-stage SaaS, 50 users, struggling to get new signups), here are your 3 highest-impact next moves:

---

### Move 1: Build a Viral Self-Serve Playground

**The Strategy:**
Replace your "Book a Demo" CTA with a zero-friction playground where visitors can try CalendarAI instantly with dummy data. Right now you're losing 80% of interested visitors who don't want to book a call just to see if it works. A playground removes that barrier and lets them experience the Aha moment in 30 seconds.

**The Exact Playbook:**

**Step 1:** Create try.calendarai.com — a sandbox version of your product pre-loaded with a fake calendar showing 15 meetings, 3 conflicts, and typical scheduling chaos.

**Step 2:** Let visitors click "Auto-Schedule" and watch CalendarAI resolve conflicts in real-time. No email required, no signup, just instant value.

**Step 3:** At the end of the demo, show the CTA: "Want this for your real calendar? Connect Google Calendar in 30 seconds."

**Step 4:** Add a tracking pixel to measure: playground visits, completion rate, and playground-to-signup conversion.

**Metrics to Track:**
- Playground visits (goal: 200/week)
- Completion rate (goal: >60%)
- Playground-to-signup conversion (goal: >15%)

**Expected Results:**
3x increase in signups within 30 days. You'll convert 15-20% of playground visitors vs. 2-3% of "Book a Demo" clicks.

**Do This Today:**
Sketch the 3-screen playground flow on paper. Screen 1: Messy calendar. Screen 2: Click "Auto-Schedule". Screen 3: Clean calendar + CTA. Share with your developer.

---

### Move 2: Use CalendarAI FOR Your ICP, Then Send Them the Results

**The Strategy:**
Find 20 busy founders on LinkedIn who are your ideal customers. Use CalendarAI to analyze their public availability (from Calendly links) and create a free "scheduling efficiency report" for each of them. Send it as a personalized gift. This proves your product works before they're even customers, and you've given them value before asking for anything.

**The Exact Playbook:**

**Step 1:** Search LinkedIn for founders posting about being overwhelmed, working 70-hour weeks, or drowning in meetings. Filter by industry: SaaS, tech, startup. Target: 20 people.

**Step 2:** Find their Calendly links (usually in bio, website, or pinned posts).

**Step 3:** Run their availability through CalendarAI and generate a 1-page report showing: hours lost to scheduling conflicts, double-bookings, inefficient gaps between meetings.

**Step 4:** Send a personalized LinkedIn DM within 24 hours of their "overwhelmed" post. Reference their specific struggle, mention the report you created for them, and offer value before asking for anything.

**Metrics to Track:**
- Reports sent: 20
- DM open rat