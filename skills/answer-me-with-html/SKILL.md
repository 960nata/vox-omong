---
name: answer-me-with-html
description: Panduan keahlian answer-me-with-html dari repo QingYunA/answer-me-with-html
repo: QingYunA/answer-me-with-html
license: MIT
---

# Answer me with HTML: answer a complex question with one HTML page

You write only the **content draft** (extended Markdown). The `am` CLI does all layout, colours, dark mode and diagram coordinates. **Do not hand-write HTML / CSS / SVG.**

Reply to the user, and write the draft, in the user's language.

## 0. When the user wants to change settings

Arguments for this call: `$ARGUMENTS`

When the arguments start with `config`, `clean` or `update`, or the user asks to change a setting, clean up pages or update this skill: read `${CLAUDE_SKILL_DIR}/references/settings.md` and follow it. That turn produces no page.

## 1. Decide: produce a page or not

Produce a page if any of these is true:
- There are ≥3 interrelated concepts, and the reader needs to see how they relate.
- There is a flow, protocol, call chain or state transition (especially with branches or several actors).
- There is a comparison across ≥3 dimensions, a trade-off between options, or a "can / cannot" list.
- There is a hierarchy or an evolution over time.

Otherwise answer in plain text. When unsure: the more the question "needs a picture to understand", the more it calls for a page.

Automatic pages are for replies to the user. An internal report returned to another agent is not one:

- If a parent agent or a coordinator delegated research, implementation, a review or a progress report, return the text or structure it asked for, with the findings and the evidence. Render no page.
- The parent consolidates the reports. Its reply to the user follows the normal rules of this section.
- If the delegated task explicitly asks for a page, render it, and return the page path together with the verification details the parent asked for. A video needs an explicit video request; delegation alone never authorizes one.
- Judge this by who receives the reply and what was asked for, not by the host or agent name.

### Always-on mode

If the context contains the `[answer-me-with-html always-on]` reminder (the user added the always-on rule to a rules file such as `CLAUDE.md` or `AGENTS.md`), the bar is lower:

- Whenever this turn gives a conclusion, summary, plan, comparison, review or explanation, attach a page.
- Do not skip it because "the answer is short". If there is a conclusion, produce a page.
- For everyday conclusions use a small page with 2–4 panels: one callout with the conclusion, plus one table or one diagram. Do not add panels just to fill space.
- Render with `--no-open`, so no browser window interrupts the user. The user opens the page by clicking the path at the end of the reply.
- Order: render the page first, then write the text reply. The reply is the last thing in the turn, with the page link on its last line (see step 5). Do not write the reply and then call `am render`. The one call that may come after the reply is the choice tool that puts the page's asks to the user, when your host can ask questions: write the reply first, so the user holds the link before answering (see step 5).
- The internal-report rule of step 1 applies here too: a delegated report that inherits the always-on rule renders no page, unless the delegated task explicitly asks for one.
- Produce no page for small talk, one or two sentences with no conclusion, pure command output, or when the user asks for plain text.

## 2. Workflow (one Bash call)

The CLI is bundled in this skill's directory: `scripts/am.mjs`, a single file with no dependencies to install; it needs only Node.js 20+. If `node` is not found or is older than v20, tell the user, show them the exact command to install the Node.js LTS (macOS `brew install node`, Windows `winget install OpenJS.NodeJS.LTS`, otherwise nvm, which adds lines to the shell profile), and run it only after they agree, then check `node --version` again. If they say no or it still fails, stop and tell them. Below, `am` always means:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/am.mjs"
```

In Claude Code, `${CLAUDE_SKILL_DIR}` is replaced with this skill's directory before you read this file, so that command and every path in this file already carry it; run them as written.

On every other host the token is left as it stands or comes out empty. There, before your first command of the turn, write the absolute path of the directory that holds this `SKILL.md` in place of `${CLAUDE_SKILL_DIR}` in every command you run and in every path you read, in this file and in the files under `references/`, and check the path once with `test -f "<that directory>/scripts/am.mjs"`. Do not put the path in a shell variable and use it in a later call: the Bash tool keeps no variable from one call to the next and a file-read tool never expands one, so a `SKILL_DIR` set in one call is empty in the next and the command becomes `/scripts/am.mjs`. The directory is the one holding `SKILL.md` and `scripts/`: `~/.agents/skills/answer-me-with-html` after `npx skills add`, `~/.claude/skills/answer-me-with-html` for a Claude Code skill install, `skills/answer-me-with-html` in the plugin checkout for a plugin install, and the path printed on the host's "Base directory for this skill" line (DeepSeek Harness). If `test -f` fails, that path is not this skill's directory: find the right one before you run anything. If the user installed the `am` command globally, you can also use `am` directly.

Keep the default output; it needs no flag. If the session cannot write to `~/.answer-me-with-html/pages` (a sandbox that allows writes only in the workspace), the CLI saves the page in a private folder in the system temporary folder and says so on a `!` line; the system may clear that folder. Add `-o "<absolute-workspace-path>/.tmp/answers/topic.html"` to `render -` before the heredoc only when the user wants the page in the workspace or the render fails with `Cannot write the page`. `-o` names an HTML file, not a folder; the CLI creates missing parent directories. Use `AM_HOME` only when the whole data directory must move.

1. First list 3–8 panels in your head. Each panel answers one sub-question only.
   The draft language follows the language of the user's question: an English question gets an English draft, a Chinese question a Chinese draft, a Japanese question a Japanese draft. The page button labels, `<html lang>` and the STE check rules switch automatically by the draft language (a draft containing kana counts as Japanese); STE applies the English or Chinese rules to each sentence by its language (Japanese sentences get only the sentence-length and paragraph-length checks, with the same character limits as Chinese; any other language gets only those two checks, counted in words). To set the language yourself, write `lang:` in the frontmatter: `en`, `zh` (Simplified Chinese), `zh-Hant` or `zh-TW` (Traditional Chinese), `ja`, or any other language tag such as `fr` or `ko`. Detection reads Chinese (Simplified, or Traditional when the text has characters written in only one form), Japanese, Korean, and Cyrillic, Arabic, Hebrew, Thai and Greek text, and reads all Latin-script text as English. Declare the language when the user writes a Latin-script language other than English, when a Chinese text is too short or too plain to show Traditional characters, or when an exact tag matters (Arabic script also writes Persian, Cyrillic also Ukrainian). A language without its own labels still gets the right `<html lang>`, with English page labels.
2. Choose components by the shape of the information (see section 4).
3. Render in one go with a heredoc:

````bash
node "${CLAUDE_SKILL_DIR}/scripts/am.mjs" render - <<'AM_EOF'
---
title: Title
---
## A Panel title
```flow
A -> B: label
```
AM_EOF
````

4. Read the output:
   - `✓ <path>`: success. Whether the browser opens automatically depends on the user's settings (`am config`); `--no-open` affects only this run. A page with STE or code warnings never opens automatically.
   - `✗ L<line> …` + `Correct example:`: no page was written. The CLI lists every error of the draft at once, in line order (`✗ n errors in the draft`). Read all of them, fix each flagged line following its example, then render again.
   - `  draft: <path>`: the CLI saved your stdin draft there, and every `L<line>` in the output matches that file. Change only the flagged lines in that file with your file-edit tool; do not send a new heredoc. Then run `am render <path>`; when a page was written, add `--replace` or reuse `-o` as the rule on rendering again below says. The CLI deletes the saved draft once it renders with no warnings. A draft you passed as a file path is not copied: edit that file.
   - `code n warnings`: a code block is longer than 40 lines, or a diff hunk has a different number of lines than its `@@` header says. Cut the block or fix the header to the lines that make the point and render again, or keep it if every line matters.
   - `STE n warnings`: rewrite the flagged lines as suggested, then render again. Retry at most 2 rounds; if warnings remain, keep the last page and say so.
   - When rendering again after a `✓`, add `--replace <path from the last ✓ line>` for a page in the data directory's `pages/` or the temporary folder's `pages/`; the CLI deletes that page once the new one is written. For a page written with `-o`, reuse the same quoted `-o` HTML file path to overwrite it in place.
   - `! Cleanup hint: …` or `! Update hint: …`: pass it on to the user in one sentence at the end of the reply, and ask whether to clean up / update. **Do not run am clean or the update command yourself**; wait until the user agrees. The CLI throttles these: the cleanup hint appears at most once every 7 days, the update hint at most once every 3 days.
5. Reply in the terminal with only 2–3 lines: one core conclusion + the page link. The 2–3 line limit is for replies to the user. If a parent agent asked for the page, also return the verification details it asked for (step 1), in full. Do not paste the draft or the HTML back into the terminal. Write this reply after the render, as the last step of the turn: render the page first, then reply. No tool call comes after the reply, except the choice tool that puts the page's asks to the user: when the page has asks and your host can ask questions (Claude Code's AskUserQuestion), write this reply first — the page link on its last line — and call that tool right after it, so the user opens the page before answering. Asking first leaves the user answering questions about a page they have not seen.
   If the render output has a `link:` line, the user runs `am serve`: use that URL as the page link instead, with the URL as the label too, and skip the local-file links below. Never start `am serve` yourself; only the user starts it.
   Otherwise, in DeepSeek Harness, write a Markdown link directly to the absolute path from the `✓` line, with the path as the label too: `[C:/Users/Name/My Pages/page.html](<C:/Users/Name/My Pages/page.html>)` on Windows or `[/abs/path.html](</abs/path.html>)` on macOS/Linux. Use forward slashes on Windows and angle brackets around the destination so spaces work. These path links open the Document Preview panel.
   In other hosts, write the page link as a Markdown link to a `file://` URL, with the URL as the label too: `[file:///abs/path.html](file:///abs/path.html)`. Take the absolute path from the `✓` line and add `file://` in front; do not percent-encode it. GUI hosts (Codex, Antigravity) render this as a clickable link, and a terminal still shows the full URL.
   If you have a `present` tool (DeepSeek Harness), call it with the absolute path from the `✓` line before you reply, so the user can open the page from a card in the app. Still end the reply with the link.
   If you have an in-app browser tool (such as `open_in_codex` in OpenAI Codex), the render output has a `link:` line, and `am config get open` is not `off`, call that tool with the link (`open_in_codex`: `target: { type: "browser", url: "<link>" }`) so the user sees the page in the app's browser pa