---
name: obsidian
description: Panduan keahlian obsidian dari repo gapmiss/obsidian-plugin-skill
repo: gapmiss/obsidian-plugin-skill
license: MIT
---

# Obsidian Plugin Development Guidelines

Follow these comprehensive guidelines derived from the official Obsidian ESLint plugin rules, submission requirements, and best practices.

## Getting Started

### Quick Start Tool

For new plugin projects, an interactive boilerplate generator is available:
- **Script**: `tools/create-plugin.js` in the skill repository
- **Command**: Invoke `create-plugin` using your agent's method (`/create-plugin`, `$create-plugin`, or `@create-plugin`)
- Generates minimal, best-practice boilerplate with no sample code
- Detects existing projects and only adds missing files

Recommend the boilerplate generator when users ask how to create a new plugin, want to start a new project, or need help setting up the basic structure.

---

## Rules Reference (eslint-plugin-obsidianmd v0.5.1)

### Submission & Naming
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 1 | Plugin ID | Omit "obsidian"; don't end with "plugin" (checked only with `validate-manifest`'s `checkId: true` — turn it on before first submission) | Include "obsidian" or end with "plugin"; rename a published plugin's id |
| 2 | Plugin name | Omit "Obsidian" and "Plugin" | Include "Obsidian" or "Plugin" anywhere in the name |
| 3 | Plugin name | Avoid parts of "Obsidian" | Use "obsi", "sidian", or a leading "ob" |
| 4 | Description | Say what it does; don't repeat or start with the name | Use "Obsidian", "This plugin", "A plugin that", or start with the name |
| 5 | Description | 10–250 chars, ending with `.`, `!`, or `?` | End with `)` or no punctuation |

### Memory & Lifecycle
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 6 | Event cleanup | Use `registerEvent()` for automatic cleanup | Register events without cleanup |
| 6a | DOM events | Use `registerDomEvent()` on the plugin or owning component | Pair `addEventListener` with manual `removeEventListener` cleanup |
| 7 | View references | Return views/components directly | Store view references in plugin properties or pass plugin as component to `MarkdownRenderer` |
| 8 | Leaf detachment | Let Obsidian handle leaf cleanup | Call `detachLeavesOfType()` in `onunload` |

### Type Safety
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 9 | TFile/TFolder | Use `instanceof` for type checking | Cast to TFile/TFolder; use `any`; use `var` |
| 10 | DOM instanceof | Use `.instanceOf(T)` for DOM Nodes/UIEvents; `e.targetNode?.instanceOf(T)` for event targets | Use `instanceof` for cross-window DOM checks, including `e.target instanceof HTMLElement` |

### UI/UX
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 11 | UI text | Sentence case — "Advanced settings"; use `acronyms`/`brands` options for proper names | Title Case — "Advanced Settings" |
| 12 | JSON locale | Sentence case in JSON locale files (`recommendedWithLocalesEn`) | Title case in locale JSON |
| 13 | TS/JS locale | Sentence case in TS/JS locale modules | Title case in locale modules |
| 14 | Command names | Omit "command" as a redundant label; "Run command" or `copy-command-id` (what the command acts on) is fine | Add "command" as a label — "Command: open note", "Open settings command" |
| 15 | Command IDs | Omit plugin ID/name from command IDs/names | Duplicate plugin ID in command IDs |
| 16 | Hotkeys | No default hotkeys | Set default hotkeys |
| 17 | Settings headings | Use `.setHeading()` | Create manual HTML headings; use "General", "settings", or plugin name in headings |

> **Note (v0.5.0):** `ui/sentence-case` is **off** in `recommended` (and the scanner doesn't run it) — sentence case is still the convention, so opt in with `"obsidianmd/ui/sentence-case": ["warn", { enforceCamelCaseLower: true }]`. `recommendedWithLocalesEn` checks English locale files (rules 12–13).

### Declarative Settings (1.13.0+)

All four `settings-tab` rules ship as `warn` in `recommended`. Rules 17a/17c/17d read `minAppVersion` from `manifest.json`; 17b is **not** version-gated.

| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 17a | `settings-tab/require-display` | Keep `display()` when `minAppVersion < 1.13.0` | Ship declarative-only settings that render nothing on older Obsidian |
| 17b | `settings-tab/prefer-setting-definitions` | Implement `getSettingDefinitions()` on every `PluginSettingTab` | Rely on `display()` alone — settings won't appear in 1.13+ global search |
| 17c | `settings-tab/prefer-update-over-display` | Call `this.update()` to re-render declarative settings | Call `this.display()` — it's bypassed when definitions are non-empty |
| 17d | `settings-tab/no-deprecated-display` | Delete `display()` once `minAppVersion >= 1.13.0` and definitions exist | Leave a dead `display()` behind (auto-fixable) |
| — | Settings data | Keep all persisted data inside `plugin.settings` | Store sibling keys via `saveData()` — auto-persist clobbers them |

> **Detection caveat:** these rules match a bare `extends PluginSettingTab` only. `extends obsidian.PluginSettingTab` is out of scope and won't be flagged — but the underlying guidance still applies.

### API Best Practices
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 18 | Active file edits | Use Editor API | Use `Vault.modify()` for active file edits |
| 19 | Background file mods | Use `Vault.process()` | Use `Vault.modify()` for background modifications |
| 20 | File deletion | Use `FileManager.trashFile()` (1.6.6+), which follows the user's "Deleted files" setting | Use `Vault.trash()` or `Vault.delete()` with a fixed destination |
| 21 | File lookup | Use `Vault.getAbstractFileByPath()` | Iterate all files with `Vault.getFiles().find()` |
| 22 | User paths | Use `normalizePath()` | Hardcode `.obsidian` path; use raw user paths |
| 23 | OS detection | Use `Platform` API | Use `navigator.platform`/`userAgent` |
| 24 | Network requests | Use `requestUrl()` | Use `fetch()` |
| 24a | Response typing | Parse `response.text` and validate/cast once at the API boundary | Pass `response.json` (typed `any`) into plugin code |
| 25 | Logging | Minimize console logging; none in `onload`/`onunload` in production | Use `console.log` in `onload`/`onunload` |
| 26 | Input suggest | Use built-in `AbstractInputSuggest` | Copy Liam's `TextInputSuggest` implementation |
| 26a | Confirm dialogs | Use built-in `ConfirmationModal` (1.13.0+); use `FileManager.promptForDeletion()` to confirm and delete files | Hand-build a `Modal` subclass with its own confirm/cancel button row |
| 27 | API compatibility | Check `minAppVersion` for API availability (e.g., `getSettingDefinitions()` 1.13.0, `setCssProps()` 1.1.7, `instanceOf()` 0.15.3) | Use APIs not available in declared minAppVersion |
| 28 | Language detection | Use Obsidian's `getLanguage()` | Use `localStorage.getItem('language')` or `i18next-browser-languagedetector` |

### Popout Window Compatibility
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 29 | Document/Window | Use `activeDocument` and `activeWindow` | Use global `document` and `window` |
| 29a | Window-wide state | Add and remove `<body>`/`<html>`/`<head>` classes, CSS variables, and styles in **each** window's document (`window-open` + open windows) | `document.body.addClass()` (main window only) or `activeDocument.body.addClass()` (whichever window has focus) |
| 29b | Getter capture | Capture `activeDocument` in a variable when the same document is needed later | Call `activeDocument` at setup and again at cleanup — it follows focus and may return different documents |
| 30 | Timers | Use `window.setTimeout()`, `window.setInterval()`, etc. (exception to rule 29); `activeWindow.requestAnimationFrame()` is fine for a popout's frames | Use bare `setTimeout()`/`setInterval()`, or `activeWindow.setTimeout()` — `prefer-window-timers` flags both |
| 31 | Main workspace UI | Use `this.app.workspace.containerEl.ownerDocument` from settings | Use `activeDocument` to update main workspace from settings window |

> **Note (v0.5.1):** `prefer-active-doc` warns in `recommended`. It reports the global `document` and offers an editor suggestion, not an autofix. Changes to `document.body`/`documentElement`/`head` get their own message and no suggestion (rule 29a). `document` in a listener on the main window's `document`/`window`, as the fallback in `activeDocument ?? document`, and lookups of main-window-only UI (status bar, ribbons) are not reported. Test, tooling, and web worker files are exempt.

> **Note (v1.13.0):** Settings now open in a new window. `activeDocument` from settings callbacks points to the settings window, not the main vault. Use `this.app.workspace.containerEl.ownerDocument` to target main workspace UI.

> **Note:** `activeDocument`/`activeWindow` are dynamic getters that track the focused window. A listener added via `activeDocument.addEventListener()` at setup cannot reliably be removed via `activeDocument.removeEventListener()` at cleanup. Prefer `registerDomEvent()` (rule 6a), which captures the target at registration.

### Event Handling
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 31 | Editor drop/paste | When the handler writes to the editor: return early on `evt.defaultPrevented`, then call `evt.preventDefault()` | Write to the editor without both checks; call `preventDefault()` in a handler that only observes (cancels Obsidian's insertion) |

### Styling
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 32 | CSS variables | Use Obsidian CSS variables for all styling | Hardcode colors, sizes, or spacing |
| 33 | CSS scope | Scope CSS to plugin containers | Use broad CSS selectors |
| 34 | Style elements | Use `styles.css` file (`no-forbidden-elements`) | Create `<link>` or `<style>` elements; assign styles via JavaScript |
| 34a | `!important` | Increase selector specificity or use CSS variables | Use `!important` — overrides user themes/snippets |
| 34b | `:has` selector | Toggle classes from TypeScript when conditions change | Use `:has` — causes broad selector invalidation and performance issues |

### Security & Compatibility
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 35 | DOM creation | Use Obsidian DOM helpers (`createEl()`, `createDiv()`, `createSpan()`, `createSvg()`, `createFragment()`) via `prefer-create-el`; in popouts, create on a parent element (`containerEl.createEl('p')`) or detached with `activeDocument.createElement()` | Use global `document.createElement()`; use `activeWindow.createEl()` — `Window` doesn't declare the helpers, so it fails `tsc` |
| 36 | Node.js modules | Load Node.js modules with `import()`/`require()` inside a `Platform.isDesktop` guard (`no-nodejs-modules`) | Static `import` of a Node built-in in a plugin that isn't `isDesktopOnly` |
| 37 | iOS compat | Avoid regex lookbehind (iOS < 16.4 incompatibility) | Use regex lookbehind |

### Accessibility (MANDATORY)
| # | Rule | ✅ Do | ❌ Don't |
|---|------|--------|----------|
| 38 | Keyboard access | Make all interactive elements keyboard accessible; Tab through all elements | Create inaccessible interactive elements |
| 39 | ARIA labels | Provide ARIA labels for icon buttons; use `data-tooltip-position` for tooltips | Use icon buttons without ARIA labels |
| 40 | Focus indicators | Use `:focus-visible` with Obsidian CSS variables; touch targets ≥ 44×44px | Remove focus indicators; make touch targets < 44×44px |

### Code Quality
| Rule | ✅ Do | ❌ Don't |
|------|--------|----------|
| Sample code | Remove all sample/template code | Keep class names like MyPlugin, SampleModal |
| Object.assign | `Object.assign({}, defaults, overrides)` (`object-assign`) | `Object.assign(defaultsVar, other)` — mutates defaults |
| LICENSE | Replace the sample's "Dynalist Inc." holder with your name (`validate-license`) | Leave the sample plugin's `Copyright (C) 2020-2025 by Dynalist Inc.` line |
| Async | Use async/await; `void` fire-and-forget promises in void callbacks (`obsidianmd/no-misused-promi