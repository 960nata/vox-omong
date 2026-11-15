---
name: dorothy
description: Panduan keahlian dorothy dari repo Charlie85270/Dorothy
repo: Charlie85270/Dorothy
license: MIT
---

# Dorothy

![Dorothy](screenshots/background-2.png)

A beautiful desktop app to orchestrate your [Claude Code](https://claude.ai/code) ,[Codex](https://chatgpt.com/codex), [Gemini](https://geminicli.com/), [Grok](https://x.ai/cli) and local agents. Deploy, monitor, and debug — all from one delightful interface. Free and open source.

![Dorothy Dashboard](screenshots/0.png)

## Table of Contents

- [Why Dorothy](#why-dorothy)
- [Core Features](#core-features)
- [Automations](#automations)
- [Kanban Task Management](#kanban-task-management)
- [Scheduled Tasks](#scheduled-tasks)
- [Remote Control](#remote-control)
- [Vault](#vault)
- [SocialData (Twitter/X)](#socialdata-twitterx)
- [Google Workspace](#google-workspace)
- [MCP Servers & Tools](#mcp-servers--tools)
- [Installation](#installation)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Configuration & Storage](#configuration--storage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Why Dorothy

AI CLI tools are powerful — but it runs one agent at a time, in one terminal. Dorothy removes that limitation:

- **Run 10+ agents simultaneously** across different projects and codebases
- **Automate agent workflows** — trigger agents on GitHub PRs, issues, and external events
- **Delegate and coordinate** — a Super Agent orchestrates other agents via MCP tools
- **Manage tasks visually** — Kanban board with automatic agent assignment
- **Schedule recurring work** — cron-based tasks that run autonomously
- **Control from anywhere** — Telegram and Slack integration for remote management

---

## Core Features

### Parallel Agent Management

Run multiple agents simultaneously, each in its own isolated PTY terminal session. Agents operate independently across different projects, codebases, and tasks.

![Agents View](screenshots/agetns.png)

**Capabilities:**
- Spawn unlimited concurrent agents across multiple projects
- Each agent runs in an isolated terminal with full PTY support
- Assign skills, model selection (sonnet, opus, haiku), and project context per agent
- Send interactive input to any running agent in real-time
- Real-time terminal output streaming per agent
- Agent lifecycle management: `idle` → `running` → `completed` / `error` / `waiting`
- Secondary project paths via `--add-dir` for multi-repo context
- Git worktree support for branch-isolated development
- Persistent agent state across app restarts
- Autonomous execution mode (`--dangerously-skip-permissions`) for unattended operation

### Super Agent (Orchestrator)

A meta-agent that programmatically controls all other agents. Give it a high-level task and it delegates, monitors, and coordinates the work across your agent pool.

![Super Agent](screenshots/super-agent.png)

- Creates, starts, and stops agents programmatically via MCP tools
- Delegates tasks based on agent capabilities and assigned skills
- Monitors progress, captures output, and handles errors
- Responds to Telegram and Slack messages for remote orchestration
- Can spin up temporary agents for one-off tasks and clean them up after

### Usage Tracking

Monitor Claude Code API usage across all agents — token consumption, conversation history, cost tracking, and activity patterns.

![Usage Stats](screenshots/stats.png)

### Skills & Plugin System

Extend agent capabilities with skills from [skills.sh](https://skills.sh) and the built-in plugin marketplace.

![Skills Management](screenshots/skills.png)

- **Code Intelligence**: LSP plugins for TypeScript, Python, Rust, Go, and more
- **External Integrations**: GitHub, GitLab, Jira, Figma, Slack, Vercel
- **Development Workflows**: Commit commands, PR review tools
- Install skills per-agent for specialized task handling

### Settings Management

Configure Claude Code settings directly — permissions, environment variables, hooks, and model defaults.

---

## Automations

Automations poll external sources, detect new or updated items, and spawn Claude agents to process each item autonomously. This enables fully automated CI/CD-like workflows powered by AI.

### Supported Sources

| Source | Status | Polling Method |
|--------|--------|---------------|
| **GitHub** | Active | `gh` CLI — pull requests, issues, releases |
| **JIRA** | Active | REST API v3 — issues, bugs, stories, tasks |
| **Pipedrive** | Planned | — |
| **Twitter** | Planned | — |
| **RSS** | Planned | — |
| **Custom** | Planned | Webhook support |

### Execution Pipeline

1. **Scheduler** triggers the automation on its cron schedule or interval
2. **Poller** fetches items from the source (e.g., GitHub PRs via `gh` CLI)
3. **Filter** applies trigger conditions (event type, new vs. updated)
4. **Deduplication** skips already-processed items using content hashing
5. **Agent spawning** — a temporary agent is created for each item
6. **Prompt injection** — item data injected via template variables
7. **Autonomous execution** — agent runs with full MCP tool access
8. **Output delivery** — agent posts results to Telegram, Slack, or GitHub comments
9. **Cleanup** — temporary agent is deleted after completion

### Template Variables

Use these in your `agentPrompt` and `outputTemplate`:

#### GitHub Variables

| Variable | Description |
|----------|-------------|
| `{{title}}` | Item title (PR title, issue title, etc.) |
| `{{url}}` | Item URL |
| `{{author}}` | Item author |
| `{{body}}` | Item body/description |
| `{{labels}}` | Item labels |
| `{{repo}}` | Repository name |
| `{{number}}` | Item number (PR #, issue #) |
| `{{type}}` | Item type (pull_request, issue, etc.) |

#### JIRA Variables

| Variable | Description |
|----------|-------------|
| `{{key}}` | Issue key (e.g., `PROJ-123`) |
| `{{summary}}` | Issue summary |
| `{{status}}` | Current issue status |
| `{{issueType}}` | Issue type (Task, Bug, Story, etc.) |
| `{{priority}}` | Issue priority |
| `{{assignee}}` | Assigned user |
| `{{reporter}}` | Reporter name |
| `{{url}}` | Issue URL |
| `{{body}}` | Issue description |

### Example: Automated PR Review Bot

```javascript
create_automation({
  name: "PR Code Reviewer",
  sourceType: "github",
  sourceConfig: '{"repos": ["myorg/myrepo"], "pollFor": ["pull_requests"]}',
  scheduleMinutes: 15,
  agentEnabled: true,
  agentPrompt: "Review this PR for code quality, security issues, and performance. PR: {{title}} ({{url}}). Description: {{body}}",
  agentProjectPath: "/path/to/myrepo",
  outputGitHubComment: true,
  outputSlack: true
})
```

### Example: JIRA Issue Processor

```javascript
create_automation({
  name: "JIRA Task Agent",
  sourceType: "jira",
  sourceConfig: '{"projectKeys": ["PROJ"], "jql": "status = Open"}',
  scheduleMinutes: 5,
  agentEnabled: true,
  agentPrompt: "Work on JIRA issue {{key}}: {{summary}}. Description: {{body}}. Priority: {{priority}}.",
  agentProjectPath: "/path/to/project",
  outputJiraComment: true,
  outputJiraTransition: true,
  outputTelegram: true
})
```

JIRA automations also create Kanban tasks automatically in the backlog, allowing agents to pick them up via the auto-assignment system.

---

## Kanban Task Management

A task board integrated with the agent system. Tasks flow through columns and can be automatically assigned to agents based on skill matching.

![Kanban Board](screenshots/kanban.png)

### Workflow

```
Backlog → Planned → Ongoing → Done
```

- **Priority levels**: Low, Medium, High
- **Progress tracking**: 0-100% per task
- **Agent assignment**: Assign tasks to specific agents or let the system auto-assign
- **Labels and tags**: Organize and filter tasks
- **Skill requirements**: Define required skills — the system matches tasks to capable agents

### Automatic Agent Assignment

The `kanban-automation` service continuously watches for new tasks and:

1. Matches task skill requirements against available agents
2. Creates new agents if no matching agent exists
3. Assigns the task and moves it to `ongoing`
4. Tracks progress as the agent works
5. Marks the task `done` when the agent completes

This enables a **self-managing task pipeline** — add tasks to the backlog and agents automatically pick them up.

---

## Scheduled Tasks

Run Claude Code autonomously on a cron schedule. Useful for recurring maintenance, reporting, monitoring, or any periodic task.

### Cron Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *
```

| Expression | Schedule |
|-----------|----------|
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 */2 * * *` | Every 2 hours |
| `30 14 * * 1` | Mondays at 2:30 PM |

### Platform Support

- **macOS**: Uses `launchd` (launchctl) for reliable background execution
- **Linux**: Uses `cron` (crontab)

### Storage

- Task definitions: `~/.claude/schedules.json`
- Generated scripts: `~/.dorothy/scripts/`
- Execution logs: `~/.claude/logs/`

---

## Remote Control

### Telegram Integration

Control your entire agent fleet from Telegram. Start agents, check status, delegate tasks to the Super Agent — all from your phone.

| Command | Description |
|---------|-------------|
| `/status` | Overview of all agents and their states |
| `/agents` | Detailed agent list with current tasks |
| `/projects` | List all projects with their agents |
| `/start_agent <name> <task>` | Spawn and start an agent with a task |
| `/stop_agent <name>` | Stop a running agent |
| `/ask <message>` | Delegate a task to the Super Agent |
| `/usage` | API usage and cost statistics |
| `/help` | Command reference |

Send any message without a command to talk directly to the Super Agent.

**Media support** via the `mcp-telegram` server: send photos, videos, and documents.

**Setup:**
1. Create a bot via [@BotFather](https://t.me/botfather) and copy the token
2. Paste the bot token in **Settings**
3. Send `/start` to your bot to register your chat ID
4. Multiple users can authorize by sending `/start`

### Slack Integration

Same capabilities as Telegram, accessible via @mentions or direct messages.

| Command | Description |
|---------|-------------|
| `status` | Overview of all agents |
| `agents` | Detailed agent list |
| `projects` | List projects with agents |
| `start <name> <task>` | Spawn and start an agent |
| `stop <name>` | Stop a running agent |
| `usage` | API usage and cost statistics |
| `help` | Command reference |

**Features:** @mentions in channels, DMs, Socket Mode (no public URL), thread-aware responses.

**Setup:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it "Dorothy" and select your workspace
3. **Socket Mode** → Enable → Generate App Token with scope `connections:write` (`xapp-...`)
4. **OAuth & Permissions** → Add scopes: `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`
5. **Install to Workspace** → Copy Bot Token (`xoxb-...`)
6. **Event Subscriptions** → Enable → Subscribe to: `app_mention`, `message.im`
7. **App Home** → Enable "Messages Tab"
8. Paste both tokens in **Settings → Slack** and enable

---

## Vault

A persistent document storage system that agents can read, write, and search across sessions. Use it as a shared knowledge base — agents store reports, analyses, research findings, and structured notes that any other agent can access later.

![Vault](screenshots/vault.png)

### Features

- **Markdown documents** with title, content, tags, and file attachments
- **Folder organization** with nested hierarchies (auto-created on document creation)
- **Full-text search** powered by SQLite FTS5 — search across titles, content, and tags
- **Cross-agent access** — any agent can read documents created by another
- **File attachments** — attach files to documents for reference

### MCP Tools

| Tool |