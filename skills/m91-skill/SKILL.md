---
name: m91-skill
description: Panduan keahlian m91-skill dari repo MSG91/m91-skill
repo: MSG91/m91-skill
license: MIT
---

# M91: when software needs a human

```
Software works → hits a moment only a person can handle → M91 rings their phone
→ they tap an answer → the software reads it → the software continues
```

The job is done when **the software continues**. Delivering the alert is not enough.
Every alert you add needs three things: someone who is asked, an answer that comes back,
and a way for it to end.

**You work autonomously.** Find the moments, choose the design, write the code, test it
and report what you did. Do not stop to ask for approval or guidance. The one thing you
cannot produce is a **credential** (a send link, an API key, or both), because a person
creates it in the M91 app on their phone. Write everything so it reads credentials from
configuration, finish the rest of the work without them, and ask for them in your final
message (step 6).

| Section | Read it when |
|---|---|
| 1. Find every moment a person is needed | always, before writing any code |
| 2. Pick the credentials | before you choose where the link is stored |
| 3. Design each alert | for each moment |
| 4. Get the answer back | when code waits on the answer |
| 5. Teach the people | always, because the integration is not done without it |
| 6. Prove it and report | at the end |
| Facts that break integrations | before you send any request |

Reference (fetch only what you need. When it disagrees with this file, the document is
right; say which two lines disagree):
[quickstart](https://m91-api.msg91.com/api/public/quickstart.md) ·
[fields](https://m91-api.msg91.com/api/public/fields.md) ·
[api](https://m91-api.msg91.com/api/public/api.md) ·
[playbook](https://m91-api.msg91.com/api/public/playbook.md) ·
[limits](https://m91-api.msg91.com/api/public/limitations-and-recommendations.md) ·
troubleshooting is bundled at `scripts/troubleshoot.md`.

---

## 1. Find every moment a person is needed

Do this whatever the request says ("add alerts", "add approval", "page me on failure").
Examples in the request are a sample, not the scope. Projects usually need a person in
more places than the request names. Walk every feature and flow from start to finish:
routes, models, screens, background jobs, agent steps, and what happens afterwards.
At each step, ask:

> Does a person need to **know** something, **acknowledge** it, **answer** a question,
> **decide**, **authorize**, **take over**, or **act in the physical world**?

Each yes is a moment. Code only shows what has already been built, so also read specs,
TODOs and half-built flows. Common kinds of moment:

- **Authorize:** an agent wants to refund ₹82,000, push to main or email a client.
- **Answer:** two policies conflict, a request is ambiguous, a budget is missing.
- **Decide:** pick a supplier, accept a recommendation, resolve two disagreeing sources.
- **Take over:** an agent cannot resolve the issue, a job is stuck on a login or a CAPTCHA.
- **Act physically:** a freezer reads 12°C, a delivery failed, a machine stopped.
- **Acknowledge:** a production outage, payments failing for 11 minutes.
- **Know:** a ₹20L lead replied, a KPI moved, an overnight job found something.

Look hardest at features that already *look* like they reach a person: deadlines,
overdue highlighting, "waiting on" statuses, priorities, a bell, a "nudge" button. A
toast or a red row reaches nobody who isn't looking. Note which of these reach nobody
today.

**Use M91 only where the person may not be looking.** If they are certainly on that
screen at that moment, show it in the app instead. If they could leave before answering,
use M91 as well.

**Success creates silence.** Alert on named conditions that a person can act on. Never
alert from a generic error handler or a logger. An expected error such as a validation
`4xx` or a plan limit is not an outage. Alert when an error persists (N times in a row,
or for N minutes) and a person can fix it. Every alert rings at full volume, so noise
teaches people to ignore the phone.

Write each moment as a card. The first line is a plain sentence that you will reuse on
the setup screen (step 5) and in your report (step 6). The rest is its whole lifecycle,
because sending an alert is only one part of the job:

```
When an urgent follow-up passes its due date, its owner is asked: I'll chase it · Snooze a day · Seen
  where:    jobs/sweep.js checkOverdue()
  answers:  I'll chase it → status=chasing, nudge logged · Snooze → due += 1 day · Seen → nothing
  silence:  stays open; the open alert is the reminder
  closes:   marked done, deleted, due date moved forward, priority lowered
  re-arms:  goes overdue again after it was closed
```

If a line in the card has no code behind it, the moment is not finished. Also list the
moments you excluded and why, in one line each.

Wire every moment you find. Do not ask which ones to keep. Your report lists them so
the person can remove any.

## 2. Pick the credentials

Decide the credential for each moment separately. A project often needs more than one:
for example, a send link for its own on-call team plus an API key to reach its users,
or an API key that creates a channel for each customer and stores the send link it gets
back.

| Who gets woken | Credential | Where it lives |
|---|---|---|
| This project's own team, the same people every time | one **send link** | project secrets, as `M91_SEND_LINK` |
| Each customer wakes **their own** people | **each customer's send link** | stored per customer, pasted into a setup screen you build (step 5) |
| A person chosen at runtime by phone number | an **API key** (`m91sk_…`) | project secrets |

- **Send link:** the token is in the URL, so the link is a credential. Never put it in
  source, a commit, a client bundle or a logged URL. Scale does not change this choice:
  ten thousand users alerting one team still use one link.
- **API key:** invites people by phone number and alerts them directly. A person must
  accept the invitation and install M91 before anything reaches them. A key can create
  channels but can never alert one. Alert a channel with the `sendLink` that creating
  it returned. A person gets the key in the M91 app under Settings → API keys →
  Create a key, and it is shown only once. Run `scripts/m91.sh <cmd> --help` and see
  [api.md#credentials](https://m91-api.msg91.com/api/public/api.md#credentials).
- No credential can be generated, guessed or derived. If you do not have one, read it
  from configuration and carry on. Step 6 asks the user for each one.

## 3. Design each alert

```bash
curl -sS -X POST "$M91_SEND_LINK" -H 'Content-Type: application/json' -d '{
  "title": "Approve ₹82,000 refund to Acme Corp?",
  "description": "Order #4411 · damaged on arrival · above the ₹50,000 auto-refund limit",
  "severity": "HIGH",
  "customId": "refund-4411",
  "responseOptions": [
    {"label": "Approve", "effect": "SHARED"},
    {"label": "Reject",  "effect": "SHARED", "required": ["note"]}
  ]
}'
```

**The title says what happened and why the person is needed**, because it is read on a
locked screen. The description holds the detail they need to choose. Labels can be at
most 24 characters.

**Choose buttons from what the software needs back.** These shapes are examples, not
text to copy:

| The software needs to… | Options | They see |
|---|---|---|
| ask for authorization | two `SHARED`, negative with `required: ["note"]` | Approve · Reject (asks why) |
| ask a question, get a decision | each real answer as `SHARED`, free text stays on | Google · Email · their own words |
| verify something | a `SHARED` option for each verdict | It's right · It's wrong · Leave it out |
| hand over (take over or act physically) | one `SHARED` claim + one `PERSONAL` | Take over · Seen / On my way · Seen |
| get someone to own an incident | one `SHARED` + `PERSONAL` | I'll handle it · Seen |
| get proof of the work | `SHARED` with `required: ["attachment"]` | Fixed it (asks for a photo) |
| have everyone confirm | `PERSONAL` only | one button each |
| just inform | `[]` **and** `"isAutoClose": true` | no buttons, closes itself |

- `SHARED` means this person takes responsibility: the other phones stand down and
  `decision` is set. `PERSONAL` means "I am aware" and never sets `decision`, so "Seen"
  can never be read as "Approved".
- **One button is not a choice.** Ask yourself what the *different* answers are.

**Severity sets how hard M91 tries:**

| Severity | Rings | Phone call |
|---|---|---|
| `LOW` | yes | never. Use it for "when you get a chance" |
| `MEDIUM` (default) | yes | never |
| `HIGH` | yes | only if nobody has responded or opened it for 3 minutes |
| `CRITICAL` | yes | always. Use it only when money or safety is draining |

**`customId` names the condition, not the event.** Use the same string every time the
same thing is detected (`payments-500s`, `disk-full-node7`). Never put a timestamp, a
UUID or a run id in it. A repeat while the alert is open alerts nobody and still returns
`success: true`. Every `customId` you open needs a code path that closes it, and that
path can run in another process:

```bash
curl -sS -X POST "$M91_SEND_LINK/close" -H 'Content-Type: application/json' -d '{"customId":"payments-500s"}'
```

`404` (nothing matched) and `403` (already closed) on close both count as success.

- **Reconcile on every write.** Find each code path that changes the underlying record
  (edit, complete, delete, a priority or date change). If the condition no longer holds
  afterwards, close the alert there.
- **Survive restarts.** The open alert lives on M91, not in your process, so M91 already
  deduplicates it. Do not build a second dedup layer. Anything that decides *when* to
  alert, such as a failure counter or a "since" timestamp, must survive a restart if the
  condition can outlast the process. On startup, re-check open conditions and close the
  ones that have cleared.

## 4. Get the answer back

Look at the code that runs after the send:

| After the send | Do this |
|---|---|
| nothing depends on the answer | send and carry on |
| something waits, and the service has a public HTTPS URL and a run that can resume from outside (a queue, a checkpointed graph) | set `callbackUrl`. When it arrives, read the alert back before acting, because callbacks cannot be verified yet |
| something waits in-process, on a laptop, in a CLI or in a private network | read back every few seconds until `decision` is set |

```bash
curl -sS "$M91_SEND_LINK/alerts/refund-4411"     # data.decision is null until a SHARED answer
```

On an API key: `scripts/m91.sh decision --phone <number> --custom-id refund-4411`.

**There is no server-side expiry, so you own the timeout.** Decide before sending what
silence means and make it the safe outcome. For example, an approval that times out is a
reject. When the wait ends, close the alert.

**Every answer must change something in the app.** If nothing reads the answer, the
button is decoration: update the state, run or block the action, and record it where the
app keeps history. The same answer can arrive twice (a callback, then a read-back), so
apply it idempotently.

**Make approval enforceable.** If an agent asks for authorization, the gated action must
not be able to run without the `SHARED` approve. Put the check in the code path that
executes the action, not in a prompt. If the action changes after approval (say, a
different amount), ask again.

**Choose how to call M91 from the project, as you would any dependency:**

| Way | Fits |
|---|---|
| plain HTTPS | any language; sending and closing alerts; a one-off read-back |
| `scripts/m91.sh` | shell scripts, cron jobs, CI steps |
| the TypeScript SDK, `npm i @msg91comm/m91` | JS/TS code that waits for an answer (`M91Client.requestApproval`, `waitForDecision`) or uses an API key (`M91Platform`). It handles the wait, the timeout, the parsing and keeping tokens out of logs |
| its framework adapters, `@msg91comm/m91/integrations/<name>` | an agent built on `langchain`, `langgr