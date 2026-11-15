---
name: agentcall
description: Panduan keahlian agentcall dari repo pattern-ai-labs/agentcall
repo: pattern-ai-labs/agentcall
license: MIT
---

# join-meeting

**IMPORTANT: Read this entire document before joining a meeting.** This file
contains the CALL_LOOP algorithm (mandatory), active participation rules,
safety requirements (leave/cleanup), and mode-specific guidance. Skipping
sections will result in broken meeting experiences — the user will be left
talking to silence.

**IMPORTANT: Read the whole document on every session, not just the parts you
remember.** This skill is updated frequently — new commands, new events, new
recommended patterns (like the event-driven `tail -f` + Monitor flow in
"How to read events") are added often. Do NOT rely on what you remember from
previous sessions. Re-read this document each time you start a meeting so you
pick up the latest guidance. If unsure whether you are on the latest version,
run `python scripts/python/check_update.py` (see "Checking for Skill Updates").

Join a video meeting as an AI bot with voice and visual presence.

## Prerequisites

- Python 3.10+ (preferred) or Node.js 18+
- Python dependencies: `pip install aiohttp websockets`
- Node.js dependencies: `cd scripts/node && npm install`
- For webpage modes: a local HTTP server running on the specified port

### API Key Setup

Before joining a meeting, make sure an API key is configured:

1. **Check** `~/.agentcall/config.json` — if it exists and has `api_key`, you're ready.
2. **Check** `AGENTCALL_API_KEY` env var — if set, you're ready.
3. **If neither exists**, get a key one of two ways:

   **Option A — Self-register via email (no dashboard, no human hand-off needed).**
   AgentCall accounts are created with a 6-digit email code. New accounts include
   free trial credits (base plan, 360 minutes), so the first call works immediately.
   ```bash
   # 1. Request a code. Use the user's email, or — if you can read your own
   #    mailbox — an address you have access to:
   python scripts/python/register.py send --email you@example.com

   # 2. Get the 6-digit code from that inbox. If you can read the mailbox yourself,
   #    retrieve it directly; otherwise ask the user to paste it. Codes expire in
   #    10 minutes; a resend is allowed after 60 seconds.

   # 3. Verify the code. This mints an API key named "AgentCall Skill on <hostname>"
   #    and saves it to ~/.agentcall/config.json:
   python scripts/python/register.py verify --email you@example.com --code 123456
   ```
   Node equivalent: `node scripts/node/register.js send --email ...` and
   `node scripts/node/register.js verify --email ... --code ...`. Both scripts use
   only the language standard library, so they run before `pip install` / `npm install`.

   **Option B — Use an existing key.** Ask the user for their API key
   (create one at https://app.agentcall.dev/api-keys), then save it:
   ```bash
   mkdir -p ~/.agentcall
   cat > ~/.agentcall/config.json << 'EOF'
   {"api_key": "USER_KEY_HERE"}
   EOF
   ```

The scripts (bridge.py, join.py, agentcall.py, register.py) automatically read
from `~/.agentcall/config.json` if `AGENTCALL_API_KEY` env var is not set.
**Do NOT ask for the API key every session** — check the config file first.

Meeting transcripts arrive as agent input — any participant in the call
can therefore steer the agent. For high-trust workflows, configure your
agent framework's permission system (e.g., Claude Code's allow allowlist,
hooks, plan mode) to restrict what the agent can do during a call. The
skill defers to the framework's enforcement. Recommended for use in
trusted meetings or properly scoped projects.

### User Preferences

**First-call detection:** if `~/.agentcall/config.json` has no `default_mode`
field saved, treat this as the user's first call.

**First call** (no `default_mode` in `~/.agentcall/config.json`): new
accounts include free trial credits. Offer the user a brief "experience
call" with `--mode webpage-av-screenshare --voice-strategy direct` so
they can see the full feature set — the `pattern` avatar (default),
screenshare, interactive webpages, and voice with barge-in. If they
prefer a simpler mode, honor that. After the call ends, ask which mode
to save as the default going forward.

**After the first call ends (in the agent conversation, not the meeting):**
Ask the user which mode to save as their default going forward. Present as a
numbered list:

  1. `webpage-av-screenshare` — everything on tap (avatar + screenshare + webpage sharing)
  2. `webpage-av` — avatar only, no screenshare
  3. `webpage-audio` — audio from a webpage into the meeting
  4. `audio` — voice only, simplest

Offer to explain any option if the user wants clarification. Mention they can
see real-world examples at https://www.youtube.com/@pattern-ai-labs.

Save the choice to `~/.agentcall/config.json`:

```json
{
  "api_key": "ak_ac_xxxxx",
  "default_mode": "webpage-av-screenshare",
  "default_voice_strategy": "direct",
  "default_voice": "af_heart",
  "default_bot_name": "Juno"
}
```

- **Subsequent sessions**: use saved defaults silently. No need to ask again.
- **Override anytime**: if the user says "join with avatar this time" or "use
  audio mode", respect it for that call without updating the saved default.
  Only update the default if the user says "always use this" or "make this
  my default."
- These are **soft defaults**, not rigid settings. The user's in-context
  request always takes priority over saved preferences.
- **All plan tiers (base, pro, enterprise) follow the same flow** — everyone
  gets the first-call demo and the post-call prompt.

## Usage

```bash
./scripts/run.sh <meet-url> [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--mode` | `audio` | `audio` (voice only, simplest), `webpage-audio` (audio from webpage), `webpage-av` (visual avatar), `webpage-av-screenshare` (avatar + screenshare). See Modes Explained below. |
| `--voice-strategy` | `direct` | `collaborative`, `direct` |
| `--bot-name` | `Agent` | Display name in the meeting participant list |
| `--port` | `3000` | Local port for webpage modes (your UI server) |
| `--screenshare-port` | `3001` | Local port for screenshare content |
| `--template` | `pattern` | Built-in UI: `pattern` (default, radial sunburst with per-state colors and the work-in-progress task list), `ring` (neon ring), `orb`, `avatar`, `dashboard`, `blank`, `voice-agent` (no local server needed) |
| `--transcription` | on | Real-time `transcript.final` and `transcript.partial` events. Required for most workflows. Disable with `--no-transcription` to save STT billing if you only need lifecycle events. |
| `--trigger-words` | | Comma-separated aliases for collaborative mode: `june,juno,hey june` |
| `--context` | | Initial context for voice intelligence (max 4000 chars) |
| `--webpage-url` | | Public URL for webpage modes (no tunnel needed) |
| `--screenshare-url` | | Public URL for screenshare content (no tunnel needed) |
| `--max-duration` | plan limit | Max call duration in minutes. Cannot exceed your plan's limit. Check https://agentcall.dev for current limits. |
| `--alone-timeout` | 120 | Leave if alone for N seconds. |
| `--silence-timeout` | 300 | Leave if silent for N seconds. |
| `--api-url` | `https://api.agentcall.dev` | Override API URL for development |

## Bot Naming

Choose STT-friendly names — short, distinctive, real-sounding words that
speech-to-text can reliably capture. Avoid generic phrases like "AI Assistant"
or "Hey Bot" — transcription often garbles these.

**Good names:** Juno, June, Nova, Sage, Atlas, Claude, Aria, Echo
**Avoid:** AI Assistant, My Bot, Hey Agent, Assistant Bot

**Always set trigger words** in collaborative mode to cover STT mishearings:
```
--bot-name "Juno" --trigger-words "juno,june,you know,junior"
--bot-name "Claude" --trigger-words "claude,cloud,clod,clawed"
--bot-name "Nova" --trigger-words "nova,no va,over"
```

The display name in the participant list can be longer (e.g., "Juno - AI Assistant")
but the trigger words should be the short phonetic variants that STT might produce.

**Allowed characters.** On Microsoft Teams a bot name may contain only letters (any language),
numbers, spaces and `- _ .` — other characters stop the bot from getting in, so AgentCall removes
them (`Juno (Phillip's notes)` joins Teams as `Juno Phillips notes`). Google Meet drops the `'`
character. The bot joins under the name returned as `bot_name` in the create-call response (the
bridges report it in `call.created` when it differs from the one you passed).

## Modes Explained

### audio (default)
Voice only. Bot has no video. Best for: AI assistants, note-takers, voice agents.
No local server needed. Simplest setup.

### webpage-audio
Your local webpage provides audio. Bot's video is black. The webpage can play audio
that meeting participants will hear. Best for: audio-only web apps.
Requires: `--port` pointing to your local HTTP server.

If your webpage is publicly hosted, pass `--webpage-url https://your-site.com/bot`
instead of `--port`. No tunnel or local server needed.

### webpage-av
Your webpage IS the bot's video feed — what renders on the page is what meeting
participants see as the bot's camera. Audio from the page is also captured into
the meeting. The page is loaded once and runs continuously. All updates must come
via WebSocket events from your agent — it does not auto-refresh.

Best for: animated avatars, branded visual presence, agent-controlled dynamic UIs.

The webpage can also be a standalone voice-to-voice agent: it receives the meeting's
audio as microphone input, processes it with its own AI backend, and replies through
the browser's speaker — which FirstCall (meeting infrastructure) captures into the meeting. This means any
existing voice agent webpage can join meetings with zero modification.

Keep it simple. The agent controls the page via WebSocket. The page renders what
the agent tells it to. Use `--template orb` or `--template avatar` for built-in options.

For slides or screen-sharing content, use `webpage-av-screenshare` instead.

### webpage-av-screenshare
Same as webpage-av PLUS the ability to screenshare. Bot has two visual presences:
- **Camera feed** — your avatar/brand page (always active, receives meeting audio via mic)
- **Screenshare** — separate content page, **inactive until you send `screenshare.start`**

**Screenshare starts inactive.** The bot joins with only the avatar visible.
Screenshare activates when the agent sends `screenshare.start` with a URL or port.
If you don't need screenshare at all, use `webpage-av` mode instead.

Bot has two visual presences when screenshare is active:
- **Camera feed** — your avatar/brand page (receives meeting audio via mic)
- **Screenshare** — separate content page (slides, charts, docs, demos)

Meeting audio is routed ONLY to the avatar page (not screenshare). Audio from
both pages is captured into the meeting.

Agent controls screenshare dynamically during the call:
- `screenshare.start` with `url` — share a public URL: `{"command": "screenshare.start", "url": "https://slides.google.com/..."}`
- `screenshare.start` with `port` — share a local server via tunnel: `{"command": "screenshare.start", "port": 3001}`
- `screenshare.stop` — stop sharing: `{"command": "screenshare.stop"}`
- `screenshare.swap` — atomically swap to a different page: `{"command": "screenshare.swap", "port": 3002}` or `{"command": "screenshare.swap", "url": "https://..."}`. Use this instead of stop+start when changing what's shared during a call — it serializes the stop and waits for FirstCall to confirm before starting the new share, which avoids races and the "old content keeps showing" bug.

Requires: `--port` AND `--screenshare-port` (local), or `--webpage-url` AND
`--screenshare-url` (public, no tunnel).

**IMPORTANT — screenshare is a live, agent-controlled canvas:**
Once loaded, the screenshare page cannot be clicked, scrolled, or typed into by
anyone — it runs in a headless browser. The agent controls what's on screen by
updating files or A