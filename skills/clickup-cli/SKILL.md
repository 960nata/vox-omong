---
name: clickup-cli
description: Panduan keahlian clickup-cli dari repo krodak/clickup-cli
repo: krodak/clickup-cli
license: MIT
---

# ClickUp CLI (`cup`) - skill version 1.46.2

Reference for AI agents using the `cup` CLI tool. Covers task management, sprint tracking, comments, time tracking, custom fields, goals, Docs, Chat, views, webhooks, workspace structure, export, and project workflows.

> **Version check:** Run `cup --version`. If your installed version is older than 1.46.2, update with `npm install -g @krodak/clickup-cli` and refresh this skill with `cup skill` (`cup skill --path <file>` installs to a custom location, `cup skill --print` writes it to stdout).

## Install & Configure

### Prerequisites

Node.js 22+ required.

### Install

```bash
npm install -g @krodak/clickup-cli
```

Or via Homebrew:

```bash
brew tap krodak/tap && brew install clickup-cli
```

### Get an API token

The user needs a personal API token from ClickUp:

1. Open https://app.clickup.com/settings/apps
2. Under "API Token", click "Generate" (or copy existing)
3. The token starts with `pk_`

### Configure

**Non-interactive (recommended for agents):**

```bash
cup init --token pk_USER_TOKEN --team TEAM_ID
```

To find the team/workspace ID, the user can check their ClickUp URL: `https://app.clickup.com/TEAM_ID/...`

**Interactive (for humans in a terminal):**

```bash
cup init
```

**Environment variables (no config file needed):**

```bash
export CU_API_TOKEN="pk_..."
export CU_TEAM_ID="12345678"
```

### Verify

```bash
cup auth
```

This prints the authenticated username and workspace. If it fails, the token or config is invalid.

## Setup

Config stored at `~/.config/cup/config.json` with named profiles. Each profile has `apiToken` and `teamId`. Optional: `sprintFolderId` to pin sprint detection to a specific folder.

Multiple profiles supported - use `cup profile add <name>` to create, `cup profile use <name>` to switch, or `-p <name>` flag for one-off overrides.

`CU_PROFILE` environment variable selects a profile (overridden by `-p` flag).

## Saved Filters (Quick Shortcuts)

At the start of each session, run `cup filter list` to discover saved shortcuts for this workspace.

| Command | What it does |
| --- | --- |
| `cup filter list [--json]` | List all saved shortcuts with commands and descriptions |
| `cup filter run <name>` | Execute a saved shortcut (identical to running the full command) |
| `cup filter save <name> <cmd> [args...] [-d desc]` | Save a command shortcut |
| `cup filter delete <name>` | Remove a shortcut |
| `cup filter show <name> [--json]` | Show a single shortcut's details |

Example: `cup filter save sprint-tasks tasks --status "in progress" --list l1 -d "Current sprint tasks"`
Then: `cup filter run sprint-tasks` is equivalent to `cup tasks --status "in progress" --list l1`

## Output Modes

| Context | Default output | Override |
| --- | --- | --- |
| Terminal (TTY) | Interactive picker UI | `--json` for JSON |
| Piped / non-TTY | Markdown tables | `--json` for JSON |

- Default piped output is **Markdown** - optimized for agent context windows
- `cup task <id>` outputs a Markdown summary when piped; use `--json` for the full raw API object
- Set `CU_OUTPUT=json` to always get JSON when piped
- Agents typically don't need `--json` unless parsing structured data with `jq`

## Commands

All commands support `--help` for full flag details. All commands support `--json`.

### Read

| Command | What it returns |
| --- | --- |
| `cup tasks [--status s] [--name q] [--type t] [--list id] [--space id] [--all] [--include-closed] [--assignee id\|me] [--tag t] [--due-before d] [--due-after d] [--created-after d] [--created-before d] [--field "Name" val]` | Tasks assigned to you (filter by status, name, type, list, space, assignee, tag, dates, custom fields). `--all` for all assignees |
| `cup assigned [--status s] [--include-closed]` | All my tasks grouped by status |
| `cup sprint [--status s] [--space nameOrId] [--folder id] [--include-closed]` | Tasks in active sprint (auto-detected) |
| `cup sprints [--space nameOrId]` | List all sprints (marks active with \*) |
| `cup search [query] [--status s] [--list id] [--space id] [--all] [--include-closed] [--assignee id\|me] [--tag t] [--due-before d] [--due-after d] [--created-after d] [--created-before d] [--field "Name" val]` | Search tasks by name, or list tasks filtered by flags when no query is given. `--all` for all assignees |
| `cup task <id>` | Single task details (custom fields, checklists, attachments, deps, links) |
| `cup subtasks <id> [--status s] [--name q] [--include-closed]` | Subtasks of a task |
| `cup comments <id>` | Comments on a task |
| `cup activity <id>` | Task details + comment history combined |
| `cup inbox [--days n] [--include-closed]` | Tasks updated in last n days (default 30) |
| `cup summary [--hours n]` | Standup: completed, in-progress, overdue |
| `cup overdue [--all] [--include-closed]` | Tasks past due date (most overdue first) |
| `cup spaces [--name partial] [--my] [--archived]` | List/filter workspace spaces |
| `cup lists <spaceId> [--name partial] [--archived]` | Lists in a space (including folder lists) |
| `cup folders <spaceId> [--name partial] [--archived]` | Folders in a space (with their lists); JSON includes `parent_folder` for subfolders |
| `cup time-in-status <id>` | Show how long a task has been in each status |
| `cup members` | Workspace members (username, ID, email) |
| `cup groups` | User groups/teams (handle, name, UUID, member count) for `--group-assignee` flags |
| `cup fields <listId>` | Custom fields on a list (type, required, options) |
| `cup attachments <taskId>` | List attachments on a task (name, size, URL) |
| `cup attach-get <taskId> [idOrTitle] [-o\|--output path] [--all] [--dir d] [--force]` | Download task attachment(s). No selector + 1 attachment downloads it; multiple requires a selector or `--all`. Saves to the attachment's filename by default |
| `cup task-members <taskId>` | List members with access to a task |
| `cup plan` | Show workspace plan and usage |
| `cup tags <spaceId>` | Tags available in a space |
| `cup goals` | Workspace goals with progress |
| `cup key-results <goalId>` | Key results for a goal |
| `cup docs [query]` | Workspace docs (optionally filter by name) |
| `cup doc <docId> [pageId]` | Doc metadata + page tree, or a specific page |
| `cup doc-pages <docId>` | All pages in a doc with content |
| `cup task-types` | Custom task types (for `--custom-item-id`) |
| `cup templates` | Task templates (for `--template`) |
| `cup list-templates` | List templates (for `list-from-template`) |
| `cup folder-templates` | Folder templates |
| `cup views <id> [--space\|--folder\|--workspace]` | List views on a list (default), space, folder, or workspace (`cup views any --workspace`) |
| `cup view <viewId>` | Get view details |
| `cup view-tasks <viewId> [--me]` | List tasks in a view (`--me` filters to you) |
| `cup open <query>` | Open task in browser by ID or name |
| `cup auth` | Check authentication status |
| `cup list-comments <listId>` | Comments on a list |
| `cup view-comments <viewId>` | Comments on a view |
| `cup webhook list` | List webhooks in workspace |
| `cup shared` | Shared spaces, folders, and lists |
| `cup chat channels [--all] [--type type]` | List chat channels |
| `cup chat channel <id>` | Show channel details |
| `cup chat messages <channelId> [--limit n]` | List channel messages |
| `cup chat members <channelId>` | List channel members |
| `cup chat followers <channelId>` | List channel followers |
| `cup chat replies <messageId>` | List message replies |
| `cup chat reactions <messageId>` | List reactions on a message |
| `cup export user\|team\|roadmap\|initiatives\|docs\|all ... [--out dir] [--dry-run] [--item-id n] [--yes]` | Export tasks/docs to a local archive (lossless JSON + markdown). See Export below |

### Write

| Command | What it does |
| --- | --- |
| `cup create -n name [-l listId\|sprint:current] [--parent parentId] [-d desc\|--description-file path] [-s status] [--priority p] [--due-date d] [--start-date d] [--time-estimate t] [--assignee id\|me] [--group-assignee uuid\|@handle,...] [--tags t] [--custom-item-id n] [--template id] [--field "Name" val]` | Create task (`--list` accepts `sprint:current`, `--field` sets custom fields inline; `--description-file` reads markdown from a file or `-` for stdin) |
| `cup update <id> [-n name] [-d desc\|--description-file path] [-s status] [--priority p] [--due-date d\|none] [--start-date d] [--time-estimate t] [--assignee id\|me] [--remove-assignee id\|me] [--group-assignee uuid\|@handle] [--remove-group-assignee uuid\|@handle] [--parent id] [--archive] [--unarchive] [--type type] [--field "Name" val]` | Update task fields (`--description-file` reads markdown from a file or `-` for stdin) |
| `cup comment <id> -m text\|--message-file path [--notify-all] [--mention user]` | Post comment (markdown auto-converted to rich text; `--message-file` reads from a file or `-` for stdin; `--mention` for real @mentions, repeatable) |
| `cup comment-edit <commentId> -m text\|--message-file path [--resolved] [--unresolved] [--mention user]` | Edit a comment (markdown auto-converted to rich text; `--mention` for real @mentions) |
| `cup comment-delete <commentId>` or `cup comment-delete --task <taskId> --mine [--match text]` | Delete a comment by ID or delete one of your task comments |
| `cup replies <commentId>` | List threaded replies |
| `cup reply <commentId> -m text\|--message-file path [--notify-all] [--mention user]` | Reply to a comment (markdown auto-converted to rich text; `--message-file` reads from a file or `-` for stdin; `--mention` for real @mentions) |
| `cup assign <id> [--to ids\|me] [--remove ids\|me] [--group uuid\|@handle,...] [--remove-group uuid\|@handle,...]` | Assign/unassign users and groups (all flags accept comma-separated values) |
| `cup depend <id> [--on taskId] [--blocks taskId] [--remove]` | Add/remove dependencies |
| `cup move <id> [--to listId\|sprint:current] [--remove listId]` | Add/remove task from lists. **`--to` + `--remove` together changes the task's _home_ list** (uses v3 `home_list` endpoint with auto status mapping). `--to` alone adds multi-list membership. `--to` accepts `sprint:current`. |
| `cup field <id> [--set "Name" value\|--set "Name" --value-file path] [--remove "Name"]` | Set/remove custom field values (`--value-file` reads the value from a file or `-` for stdin; use for long/free-text values) |
| `cup field-create <name> -t <type> [-d desc] [--options "a,b,c"] [--required] [--list id] [--lists id1,id2]` | Create a custom field — workspace-wide (default), on one list (`--list`), or bulk across lists (`--lists`, parallel, per-list reporting) |
| `cup tag <id> [--add tags] [--remove tags]` | Add/remove tags on a task |
| `cup link <taskId> <linksTo> [--remove]` | Link/unlink tasks |
| `cup attach <taskId> <filePath>` | Upload file attachment |
| `cup delete <id> [--confirm]` | Delete task (DESTRUCTIVE) |
| `cup list-delete <listId> [--confirm]` | Delete list (DESTRUCTIVE, requires --confirm in non-interactive) |
| `cup folder-delete <folderId> [--confirm]` | Delete folder (DESTRUCTIVE, requires --confirm in non-interactive) |
| `cup space-delete <spaceId> [--confirm]` | Delete space (DESTRUCTIVE, requires --confirm in non-interactive) |
| `cup duplicate <taskId>` | Duplicate a task |
| `cup bulk status <status> <taskIds...>` | Bulk update status |
| `cup bulk assign <taskIds...> [--to userId\|me] [--remove userId\|me]` | Bulk assign/unassign user from tasks |
| `cup bulk due-date <date\|none\|clear> <taskIds...>` | Bulk set or clear due dates |
| `cup bulk tag <tagName> <taskIds...> [--remove]` | Bulk add/remove tag from tasks |
| `cup bulk priority <taskIds...> --to <priority>` | Bulk set priority on many tasks |
| `cup bulk field <taskIds...> --set "Name" value` | Bulk set a custom field value |
| `cup bulk move <taskIds...> --to <listId>` | Bulk move tasks to a destination list |
| `cup checklist view <id>` | View checklists on a task |
| `