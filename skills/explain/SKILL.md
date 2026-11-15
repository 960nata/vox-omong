---
name: explain
description: Panduan keahlian explain dari repo SerhiiKorniienko/bullshit-detector
repo: SerhiiKorniienko/bullshit-detector
license: MIT
---

# explain

Make the content understandable without dumbing it down dishonestly.

## Workflow

1. **Get the text** (via `fetch-content` skill script if it's a URL, else web fetch or paste).
2. **Pick the depth** — from the user's request, or ask one short question if genuinely unclear:
   - **ELI5** — analogies, zero jargon, the core mechanism only
   - **Practitioner** — assumes general technical literacy, focuses on how it works and what to do with it
   - **Deep dive** — mechanisms, edge cases, history, competing views
3. **Explain**, structured as:
   - The one-sentence version first
   - The mechanism: how it actually works, step by step
   - **Glossary**: every jargon term the content uses without defining, one line each
   - **What the content assumes you know** — the missing prerequisites that made it confusing
   - Where the content's own explanation is wrong or oversimplified, if it is — flag it, don't repeat it

## Rules

- Explaining ≠ endorsing. If the content's claim is contested, present the explanation *and* note the contest ("the video asserts X; the standard view is Y").
- Analogies must survive scrutiny — say where the analogy breaks.
- If the user points at a specific segment ("the part at 12:30", "section 3"), explain that segment in the context of the whole, not in isolation.
- Don't pad: a concept that takes three sentences gets three sentences.