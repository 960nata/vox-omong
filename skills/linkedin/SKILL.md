---
name: linkedin
description: Panduan keahlian linkedin dari repo Linked-API/linkedin-skills
repo: Linked-API/linkedin-skills
license: MIT
---

# LinkedIn Skill

You have access to `linkedin` – a CLI tool for LinkedIn automation. Use it to fetch profiles, search people and companies, send messages, manage connections, create posts, react, comment, and more.

Each command sends a request to Linked API, which runs a real cloud browser to perform the action on LinkedIn. Operations are **not instant** – expect 30 seconds to several minutes depending on complexity.

If `linkedin` is not available, install it:

```bash
npm install -g @linkedapi/linkedin-cli
```

## Authentication

If a command fails with exit code 2 (authentication error), ask the user to set up their account:

1. Go to [app.linkedapi.io](https://app.linkedapi.io) and sign up or log in
2. Connect their LinkedIn account
3. Copy the **Linked API Token** and **Identification Token** from the dashboard

Once the user provides the tokens, run:

```bash
linkedin setup --linked-api-token=TOKEN --identification-token=TOKEN
```

## Global Flags

Always use `--json` and `-q` for machine-readable output:

```bash
LINKEDAPI_CLIENT=skill:linkedin linkedin <command> --json -q
```

When using this skill, run every `linkedin ...` example below with the
`LINKEDAPI_CLIENT=skill:linkedin` prefix so Linked API can attribute usage to the skill.

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output |
| `--quiet` / `-q` | Suppress stderr progress messages |
| `--fields name,url,...` | Select specific fields in output |
| `--no-color` | Disable colors |
| `--account "Name"` | Use a specific account for this command |

## List Flags

Flags described below as comma-separated split their value on every comma. When any value contains a comma itself – a location such as `Chicago, Illinois`, an industry such as `Technology, Information and Internet`, a company such as `Example Co., Ltd.` – pass the whole list as a JSON array instead, or the value is silently split into separate filters. The JSON form needs linkedin-cli 1.2.24 or newer (`linkedin --version`; update with `npm install -g @linkedapi/linkedin-cli`):

```bash
linkedin person search --term "designer" --locations '["Chicago, Illinois","London, United Kingdom"]' --json -q
```

## Output Format

Success:
```json
{"success": true, "data": {"name": "John Doe", "headline": "Engineer"}}
```

Error:
```json
{"success": false, "error": {"type": "personNotFound", "message": "Person not found"}}
```

Exit code 0 means the API call succeeded – always check the `success` field for the action outcome. Non-zero exit codes indicate infrastructure errors:

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success (check `success` field – action may have returned an error like "person not found") |
| 1 | General/unexpected error |
| 2 | Missing or invalid tokens |
| 3 | Subscription/plan required |
| 4 | LinkedIn account issue |
| 5 | Invalid arguments |
| 6 | Rate limited |
| 7 | Network error |
| 8 | Workflow timeout (workflowId returned for recovery) |

## Commands

### Fetch a Person Profile

```bash
linkedin person fetch <url> [flags] --json -q
```

Optional flags to include additional data:
- `--experience` – work history
- `--education` – education history
- `--skills` – skills list
- `--languages` – languages
- `--posts` – recent posts (with `--posts-limit N`, `--posts-since TIMESTAMP`)
- `--comments` – recent comments (with `--comments-limit N`, `--comments-since TIMESTAMP`)
- `--reactions` – recent reactions (with `--reactions-limit N`, `--reactions-since TIMESTAMP`)

Only request additional data when needed – each flag increases execution time.

```bash
# Basic profile
linkedin person fetch https://www.linkedin.com/in/username --json -q

# With experience and education
linkedin person fetch https://www.linkedin.com/in/username --experience --education --json -q

# With last 5 posts
linkedin person fetch https://www.linkedin.com/in/username --posts --posts-limit 5 --json -q
```

### Endorse a Person's Skills

```bash
linkedin person endorse <url> --skill 'Project Management' --json -q
linkedin person endorse <url> --pattern manage --pattern '^scrum$' --json -q
linkedin person endorse <url> --all --json -q
```

Choose exactly one of `--skill`, `--pattern` or `--all`:
- Use `--skill` for one exact skill name; letter case and extra spaces are ignored.
- Use repeatable `--pattern` to select skills matching any of the patterns. Patterns use RE2, are case-insensitive and match anywhere in the name. Anchor with `^…$` to match a whole name. Provide 1-20 patterns, each 1-200 characters; lookaround and backreferences are unsupported.
- Use `--all` only when the user wants every skill endorsed. It omits the patterns parameter; never send an empty patterns array.

Skill names are in the profile owner's language, regardless of your own LinkedIn language. Fetch the profile with `--skills` first when you need to discover the names; a German profile may list `Projektmanagement` rather than `Project Management`.

Only **1st-degree connections** can receive endorsements. An already-endorsed skill stays endorsed and counts as success. Each successful endorsement, including an existing one, counts toward the account's `stEndorsements` limit. With `--pattern` or `--all`, check every item's `success` and `error.type` in `data`: a failed skill does not stop the others, and `limitExceeded` can affect only part of the result.

### Search People

```bash
linkedin person search [flags] --json -q
```

| Flag | Description |
|------|-------------|
| `--term` | Search keyword or phrase; required unless `--url` is given |
| `--url` | LinkedIn people search URL (`linkedin.com/search/results/people/...`), such as an anonymous viewer's `searchUrl`; overrides `--term` and the filters |
| `--limit` | Max results |
| `--first-name` | Filter by first name |
| `--last-name` | Filter by last name |
| `--position` | Filter by job position |
| `--locations` | Comma-separated locations |
| `--industries` | Comma-separated industries |
| `--current-companies` | Comma-separated current company names |
| `--previous-companies` | Comma-separated previous company names |
| `--schools` | Comma-separated school names |
| `--connection-degrees` | Comma-separated connection degrees: `1st`, `2nd`, `3rd+` |

```bash
linkedin person search --term "product manager" --locations "San Francisco" --json -q
linkedin person search --term "engineer" --current-companies "Google" --limit 20 --json -q
linkedin person search --url "https://www.linkedin.com/search/results/people/?keywords=CTO" --json -q
```

### Fetch a Company

```bash
linkedin company fetch <url> [flags] --json -q
```

Optional flags:
- `--employees` – include employees
- `--dms` – include decision makers
- `--posts` – include company posts

Employee filters (require `--employees`):

| Flag | Description |
|------|-------------|
| `--employees-limit` | Max employees to retrieve |
| `--employees-first-name` | Filter by first name |
| `--employees-last-name` | Filter by last name |
| `--employees-position` | Filter by position |
| `--employees-locations` | Comma-separated locations |
| `--employees-industries` | Comma-separated industries |
| `--employees-schools` | Comma-separated school names |
| `--employees-connection-degrees` | Comma-separated connection degrees: `1st`, `2nd`, `3rd+` |

| Flag | Description |
|------|-------------|
| `--dms-limit` | Max decision makers to retrieve (requires `--dms`) |
| `--posts-limit` | Max posts to retrieve (requires `--posts`) |
| `--posts-since` | Posts since ISO timestamp (requires `--posts`) |

```bash
# Basic company info
linkedin company fetch https://www.linkedin.com/company/name --json -q

# With employees filtered by position
linkedin company fetch https://www.linkedin.com/company/name --employees --employees-position "Engineer" --json -q

# With decision makers and posts
linkedin company fetch https://www.linkedin.com/company/name --dms --posts --posts-limit 10 --json -q
```

### Search Companies

```bash
linkedin company search [flags] --json -q
```

| Flag | Description |
|------|-------------|
| `--term` | Search keyword; required unless `--url` is given |
| `--url` | LinkedIn companies search URL (`linkedin.com/search/results/companies/...`); overrides `--term` and the filters |
| `--limit` | Max results |
| `--sizes` | Comma-separated sizes: `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1001-5000`, `5001-10000`, `10001+` |
| `--locations` | Comma-separated locations |
| `--industries` | Comma-separated industries |

```bash
linkedin company search --term "fintech" --sizes "11-50,51-200" --json -q
```

### Send a Message

```bash
linkedin message send <person-url> '<text>' --json -q
```

Text up to 1900 characters. Wrap the message in single quotes to avoid shell interpretation issues.

```bash
linkedin message send https://www.linkedin.com/in/username 'Hey, loved your latest post!' --json -q
```

### Inbox

To read messages use `inbox get`. Call `message get` only when you need a person's earlier history, and never repeat it to check for new messages.

Enable inbox monitoring once per account, before sending messages whose replies you need – it captures only messages that arrive after it is on:

```bash
linkedin inbox sync --json -q          # standard inbox
linkedin inbox sync --nv --json -q     # Sales Navigator inbox
```

New messages from everyone, with an advancing `--since`:

```bash
linkedin inbox get --since 2024-01-15T10:30:00Z --json -q
```

The whole known conversation with one person, including history loaded by `message get`:

```bash
linkedin inbox get --person https://www.linkedin.com/in/username --json -q
```

With `--person`, the output has `messages` and `threads`. Each thread has `historyComplete`: if it is `false` and you need earlier messages, run `message get <person-url>` once, then `inbox get --person` again. A hashed person URL (`personHashedUrl` from a message) always matches; a public URL matches only once Linked API knows it, so prefer the hashed URL when messages show `personPublicUrl: null`. Message times are whole minutes: to check for a reply, pass `--type` of your message and `--since` a few minutes before it, take the earliest `us` message in the result (the one you sent, not a later follow-up) and count a `them` message that is not earlier than it; if your message is not in the result yet, the reply is not known yet.

### Get Conversation

```bash
linkedin message get <person-url> [--since TIMESTAMP] --json -q
```

Loads the person's earlier history on the first call, which may take longer; subsequent calls are faster. Prefer `linkedin inbox get --person <url>` to read messages – use this only when you need history from before inbox monitoring was enabled.

```bash
linkedin message get https://www.linkedin.com/in/username --json -q
linkedin message get https://www.linkedin.com/in/username --since 2024-01-15T10:30:00Z --json -q
```

### Connection Management

#### Check connection status

```bash
linkedin connection status <url> --json -q
```

#### Send connection request

```bash
linkedin connection send <url> [--note 'text'] [--email user@example.com] --json -q
```

#### List connections

```bash
linkedin connection list [flags] --json -q
```

| Flag | Description |
|------|-------------|
| `--limit` | Max connections to return |
| `--since` | Only connections made since ISO timestamp (only works when no filter flags are used) |
| `--first-name` | Filter by first name |
| `--last-name` | Filter by last name |
| `--position` | Filter by job position |
| `--locations` | Comma-separated locations |
| `--industries` | Comma-separated industries |
| `--current-companies` | Comma-separated current company names |
| `--previous-companies` | Comma-separated previous company names |
| `--schools` | Comma-separated school names |

```bash
linkedin connection list --limit 50 --json -q
linkedin connection list --current-companies "Google" --position "Engineer" --json -q
linkedin connection list --since 2024-01-0