---
name: pachca
description: Panduan keahlian pachca dari repo pachca/openapi
repo: pachca/openapi
license: MIT
---

# Pachca

Pachca is a team chat app: a workspace of employees with chats, channels, threads, reminders, tags and bots.
All of it is reachable through one public API, exposed three ways: the MCP server (a `pachca_*` tool per API
method), the CLI `@pachca/cli` (a `pachca <section> <action>` command per method) and the REST API. This skill
gets you connected, explains why something is or is not available, and routes you to the skill for the work.

## When to use

- Pachca is mentioned and you have no Pachca tools, no CLI login and no token yet.
- The user asks to connect Pachca to Claude Code, Cursor, Codex, ChatGPT or another agent app, or to a server-side agent.
- A tool or CLI command fails with `401`, `402` or `403`, or a tool the user expects is missing.
- You need to know whose name you act under and what that account may do.
- For everything else pick a sibling from [Where to go next](#where-to-go-next).

## Core concepts

- **Workspace** (пространство): one organization. One connection works with one workspace.
- **Workspace roles**: owner, admin, employee (`user`), multi-guest (`multi_guest`), guest (`guest`). The owner
  also has `role: admin`, so the user object does not tell the owner apart. Guests get no API access at all:
  no token, no CLI, no MCP.
- **Chats**: group chats and channels, open or closed, plus direct messages. A thread hangs under a message; an
  unattached thread exists without a chat. The chat role (creator, admin, editor, member or subscriber) is
  independent of the workspace role: a workspace admin is an outsider in a closed chat they are not in.
- **Bot**: a separate workspace member with its own name. It sees all open group chats and channels plus the
  closed chats and threads it was added to.

## Pick the access path

Every path calls the same API methods with the same rights.

| Who works with Pachca, and where                                             | Use                            |
| ---------------------------------------------------------------------------- | ------------------------------ |
| An employee, from an agent app (Claude, Claude Code, Cursor, VS Code, Codex) | MCP server                     |
| An agent that runs terminal commands and needs to save context               | CLI                            |
| Your own integration or service                                              | REST API or SDK → `pachca-api` |
| An agent that lives in Pachca and is called by @mention or in a DM           | a bot → `pachca-ai-agent`      |

If MCP tools are already connected, use them. The CLI is the terminal alternative: it spends less context
(the agent learns commands from `--help`) but needs a shell.

## Connect over MCP

Address `https://mcp.pachca.com/mcp`, transport Streamable HTTP. Choose how to sign in:

| Way                                               | Fits                                                                                                                                                         | Acts as                   | Lifetime                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------ |
| Browser, consent screen                           | Claude Code, the Claude app, VS Code, GitHub Copilot CLI, Codex, the ChatGPT desktop app (through Codex), Grok Bot (asked in its chat to connect the server) | the employee who approved | 1 hour, refreshes itself |
| Personal token in `Authorization: Bearer <token>` | Cursor, SourceCraft Code Assistant, Qwen Code, GigaCode CLI, OpenCode, Devin Desktop, Cline, Kilo Code, Gemini CLI, nobody to sign in (CI)                   | the token owner           | until deleted            |
| Bot token in `Authorization: Bearer <token>`      | an agent with no employee present: a server, Yandex AI Studio, GigaChat                                                                                      | the bot                   | until deleted            |

**With the Pachca plugin** the server is already configured: do not add a second one by hand, do what the
table says for your client. Check the list (`claude mcp list`, `codex mcp list`, `copilot mcp list`,
`agent mcp list` in Cursor). In Claude Code a server added by hand at the same address hides the plugin's
server.

| Client                      | Plugin's server                    | Sign in                                                                                                                                 |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code                 | `plugin:pachca:pachca`             | `/mcp`, or `claude mcp login plugin:pachca:pachca` in the terminal. Installed from the shell during a session: `/reload-plugins` first  |
| Claude app, Cowork          | on the plugin's **Connectors** tab | **Add**, then **Connect** there. On Team and Enterprise the organization owner adds the connector first, members only press **Connect** |
| VS Code, GitHub Copilot CLI | `pachca`                           | the browser opens on first use. To retry in Copilot CLI: `/mcp auth pachca`                                                             |
| Cursor                      | `plugin-pachca-pachca`             | no sign-in: it sends the token from `PACHCA_TOKEN`. Put a personal token there, restart Cursor                                          |
| Codex                       | `pachca`                           | `codex mcp login pachca` (`--no-browser` prints the link)                                                                               |

**Without the plugin**, Claude Code and Codex:

```bash
# Claude Code
claude mcp add --transport http pachca https://mcp.pachca.com/mcp   # then /mcp; --scope user: all projects
claude mcp login pachca                                              # from the terminal; with no browser, prints the link
# Codex: CLI, IDE extension and ChatGPT desktop app share it. Adding starts the browser sign-in
codex mcp add pachca --url https://mcp.pachca.com/mcp
codex mcp login pachca                                               # retry; --no-browser prints the link
# Codex where nobody can sign in (CI): a personal token. Replaces a server of the same name, the plugin's too
codex mcp add pachca --url https://mcp.pachca.com/mcp --bearer-token-env-var PACHCA_TOKEN
```

GitHub Copilot CLI and VS Code, Gemini CLI, Devin, Qwen Code, GigaCode CLI, Cursor, OpenCode, the Claude app,
the other clients, and installing the skills without the plugin:
[references/mcp-clients.md](references/mcp-clients.md).

Do it right:

- Browser sign-in needs a client that supports OAuth with a Client ID Metadata Document. Codex does from
  0.148.0: an older Codex says `Dynamic client registration not supported`, so ask the person to update it
  (`codex --version`). If sign-in still fails or the client asks you to register a client, connect with a
  personal token in the header instead.
- Do not narrow the scopes of a browser sign-in (`codex mcp login --scopes`, `scopes` in the client's config):
  the program asks for the scopes and the consent screen only shows them, with no choice. A narrowed
  connection lists the same tools and refuses the rest with `insufficient_scope`. A missing scope takes a new
  sign-in without the narrowing; retrying the call does not help. To limit an agent, give it a read-only
  personal token instead (below).
- The consent screen has no workspace picker, and neither has a CLI browser login: access goes to the workspace
  open in that browser. Wrong workspace: revoke the connection (CLI: `pachca auth logout`), switch workspaces in
  Pachca in that browser, sign in again.
- Several workspaces: add the server several times under different names (`pachca-main`, `pachca-partner`),
  each with a personal token created in its own workspace.
- A server-side agent that answers many people connects with a **bot token**. With a personal token everyone
  talking to it would act as you.
- Read-only agent: a separate personal token with only read and search scopes. The tool list stays the same;
  writes are refused with `insufficient_scope`.
- Keep the token in an environment variable such as `PACHCA_TOKEN`, never in a config file that lands in the
  repository. The program reads it from the environment it was started in: set it in the shell profile (on
  Windows, in the system environment variables) and restart the program. An app started outside the terminal,
  such as the ChatGPT desktop app, may still not see it.
- All tool descriptions together take tens of thousands of tokens. If the client allows, turn off the tools
  the agent does not need.

## Connect with the CLI

Needs Node.js 20+.

```bash
npm install -g @pachca/cli
pachca auth login                         # an employee at the terminal confirms in the browser
export PACHCA_TOKEN=YOUR_ACCESS_TOKEN     # CI, scripts, agents: a ready token, no login step
npx -y @pachca/cli users list             # one-off run without installing, token from PACHCA_TOKEN
```

- `pachca auth login` prints an address and a code and waits for approval; `--no-browser` prints them
  without opening a browser. The token lives an hour and refreshes itself. Its scopes are the whole catalog
  cut by your role at the moment of approval, and they do not grow later.
- `pachca auth login` without `--token` needs a person at a terminal. Your own shell is usually not one (no
  TTY), and CI is not either: the command fails at once with "Token required in non-interactive mode", and a
  retry fails the same way. Ask the user to run `pachca auth login` in their own terminal window (for the
  MCP server, `/mcp` in Claude Code), wait for them, then check with `pachca auth status`. Never ask for a
  token in the conversation. The user saves a ready token in their own terminal (next bullet) or puts
  `PACHCA_TOKEN` in the environment the agent starts from. CI and unattended agents take `PACHCA_TOKEN` from
  their secrets and add `--no-input`.
- Pass a copied token through stdin, not as an argument: `pbpaste | pachca auth login --token -`. An argument
  stays in shell history and in the process list.
- Token sources in order: `--token`, `--profile`, `PACHCA_TOKEN`, `PACHCA_PROFILE`, the active profile. A
  forgotten `PACHCA_TOKEN` silently wins over `PACHCA_PROFILE` and the active profile; name the profile with
  `--profile` to be sure which workspace a command hits.
- Discover instead of guessing: `pachca commands`, `pachca <section> <action> --help`, `pachca api ls`,
  `pachca api POST /messages --describe`. Add `-o json` for machine-readable output.

## Connect to the REST API

Base URL `https://api.pachca.com/api/shared/v1`, header `Authorization: Bearer <token>`, JSON bodies. Personal
token: **Интеграции > API**; bot token: the **API** tab of the bot card. The value is shown once. Response
shapes, pagination, limits, errors, uploads and SDKs → `pachca-api`.

## Which token

| Task                                                                   | Token                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| You or your agent on your own machine, an MCP client app               | personal: CLI login, MCP browser sign-in, or a personal token in the header |
| A script or personal automation acting as you                          | personal, created in the UI                                                 |
| No employee present: CI, server, cloud worker, chat bot, notifications | bot, with only the sc