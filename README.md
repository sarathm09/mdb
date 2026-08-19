# Markdown Browser

A CLI tool that opens a web-based file explorer for browsing, creating, reviewing, viewing, and editing markdown files in any directory. Features split edit/preview, portable inline comments, presentation mode, responsive themes, export options, resizable images, syntax-highlighted code blocks, Mermaid diagrams, and a full CodeMirror editor.

## Quick Start

Run directly without installing:

```bash
npx @sarathm09/mdb [directory]
bunx @sarathm09/mdb [directory]
```

Convert Markdown without starting the UI:

```bash
mdb convert README.md --to html
mdb convert README.md --to rich-text --output README.rtf
mdb convert README.md --to docx
mdb convert README.md --to pdf
```

Read or export portable review comments for an AI agent:

```bash
mdb comments list README.md
mdb comments export README.md --output README.review.json
mdb comments reply README.md <comment-id> --body "Addressed in the latest revision"
mdb comments block README.md <comment-id>
```

## Install

### From npm (recommended)

```bash
npm install -g @sarathm09/mdb
# or
pnpm add -g @sarathm09/mdb
# or
yarn global add @sarathm09/mdb
# or
bun add -g @sarathm09/mdb
```

### From source

```bash
git clone https://github.com/sarathm09/mdb.git
cd mdb
bun install
bun run build
```

### Global Install (development from source)

```bash
# From the project directory, link globally
bun link

# Ensure ~/.bun/bin is in your PATH (add to ~/.zshrc or ~/.bashrc if not)
export PATH="$HOME/.bun/bin:$PATH"

# Now use from anywhere
mdb              # opens current directory
mdb ~/docs       # opens specific directory
mdb ./notes      # relative paths work too
```

To unlink: `bun unlink @sarathm09/mdb`

### Prerequisites

- [Node.js](https://nodejs.org) v18+ or [Bun](https://bun.sh) v1.x or later

## Usage

```bash
# Run from project directory
bun run start

# Run with HMR (development)
bun run dev

# Build frontend (required before first run or after client changes)
bun run build

# Run on a specific directory
bun run src/cli.ts /path/to/folder
```

The server starts on a random port and opens your browser automatically.

## Features

- **File Explorer** - Grid view of files and folders with icons, sizes, and dates
- **Collapsible Sidebar** - File tree with hamburger toggle, breadcrumb navigation
- **Markdown Preview** - Rendered HTML with full GFM support:
  - Syntax-highlighted, inset code blocks with one-click copy
  - Mermaid diagrams (lazy-loaded)
  - Tables, task lists, blockquotes, links, and horizontally resizable images
  - DOMPurify sanitization for security
- **Broad File Preview** - Images, source/text, formatted JSON, Mermaid files, Excalidraw drawings, PDF, audio, video, and sandboxed HTML
- **Markdown Editor** - CodeMirror 6 with:
  - Theme-aware syntax highlighting
  - Markdown syntax highlighting
  - Language-aware code block highlighting
  - Cmd/Ctrl+S to save
  - Unsaved changes indicator
- **Editing Modes** - Switch between Preview, Edit, and responsive side-by-side Edit + Preview
- **Create Files** - New markdown file dialog with auto `.md` extension
- **Presentation Mode** - Turn any markdown file into a slide deck with keyboard navigation
- **Export Features** - Export files as Markdown, HTML, or PDF; export presentations as PNG zip or PDF
- **Themes** - 5 built-in palettes: Graphite, Midnight Blue, Deep Mocha, Near Black, and Soft Daylight
- **Command Palette** - Quick file search and actions via `Cmd+Shift+P`
- **Keyboard Shortcuts** - Comprehensive shortcuts for navigation, editing, and presentation
- **Security** - Path traversal protection (can't navigate above root directory)
- **Inline Review** - Select text across words, sentences, or lines; add general or blocking comments; reply in a document side panel
- **Responsive Workspace** - Animated explorer/comments panels, compact responsive navbar actions, routed settings page, and full-path breadcrumbs with copy support
- **Portable Comments** - Review data is stored beside each file as `<file>.mdb-comments.json`, so moving or copying both files preserves review context
- **Agent Review Skill** - Starting MDB installs an `mdb-comments` skill for Claude Code, Codex-compatible agents, and OpenCode so agents can address portable comment threads through the CLI
- **CLI Conversion** - Convert Markdown to standalone HTML, rich text (`.rtf`), Word (`.docx`), or PDF

## Presentation Mode

Turn any markdown file into a full-screen slide presentation.

**Entering Presentation Mode:**
- Click the presentation button in the topbar, or
- Press `Cmd+Shift+Enter`

**Creating Slides:**
Slides are separated by horizontal rules using `---`, `***`, or `___` in your markdown.

```markdown
# Slide One

Content for the first slide.

---

# Slide Two

Content for the second slide.

***

# Slide Three

More content here.
```

**Auto-splitting:**
If a slide's content overflows the visible area, it is automatically split into vertical sub-slides. Block elements that trigger a split include: H1-H6, PRE, TABLE, BLOCKQUOTE, UL, OL, HR, and DIV.

**Navigation:**
- Arrow keys to move between slides
- `Q` to exit presentation mode

## Export Features

**File Export Formats:**
- Markdown (with or without section markers)
- HTML (standalone, self-contained)
- PDF (via print dialog)

**Clipboard:**
- Copy as Markdown
- Copy as Rich Text (preserves code blocks and formatting)

**Presentation Export:**
- PNG zip (one image per slide)
- PDF

**Keyboard Shortcut:**
- `Cmd+Shift+E` opens the export menu

## Themes

Five built-in themes are available, configurable via the Settings dialog:

| Theme | Style |
|-------|-------|
| Graphite | Neutral charcoal with amber accents |
| Midnight Blue | Cool navy with blue accents |
| Deep Mocha | Near-black with soft pastel accents |
| Near Black | High-contrast dark palette |
| Soft Daylight | Clean light palette without dark-theme shadows |

## Keyboard Shortcuts

Press `?` at any time to open the shortcuts help modal.

### General

| Shortcut | Action |
|----------|--------|
| `Cmd+D` | Toggle sidebar |
| `Cmd+,` | Toggle settings page |
| `Cmd+Shift+P` | Command palette |
| `Cmd+Shift+C` | Toggle comments pane |
| `Cmd+Alt+C` | Comment selected text |
| `Cmd+Shift+V` | Toggle split edit and preview |
| `Cmd+Shift+Enter` | Presentation mode |
| `Cmd+Shift+E` | Export menu |
| `?` | Shortcuts help |
| `Escape` | Close dialog / deselect |

### Editor

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Bold |
| `Cmd+I` | Italic |
| `Cmd+U` | Underline |
| `Cmd+K` | Insert link |
| `Cmd+Shift+X` | Strikethrough |
| `Cmd+Shift+K` | Code block |
| `Cmd+S` | Save |

### Explorer

| Shortcut | Action |
|----------|--------|
| `j` / `ArrowDown` | Move down |
| `k` / `ArrowUp` | Move up |
| `l` / `Enter` | Open file or folder |
| `h` / `Backspace` | Go to parent directory |
| `g` | Jump to first item |
| `G` | Jump to last item |

### Presentation

| Shortcut | Action |
|----------|--------|
| Arrow keys | Navigate slides |
| `Q` | Exit presentation |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Backend**: [Hono](https://hono.dev) on Bun.serve()
- **Frontend**: [Svelte 5](https://svelte.dev) (compiled via custom Bun plugin)
- **Markdown**: [Marked](https://marked.js.org) + [highlight.js](https://highlightjs.org) + [Mermaid](https://mermaid.js.org)
- **Editor**: [CodeMirror 6](https://codemirror.net)
- **Bundling**: Bun.build() with custom Svelte plugin

## API

The server exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files?path=.` | List directory contents |
| GET | `/api/file?path=README.md` | Read file content |
| PUT | `/api/file` | Save file `{path, content}` |
| POST | `/api/file` | Create file `{directory, name}` |
| GET | `/api/raw?path=image.png` | Serve raw file (images, etc.) |

## Review Sidecars

Comments for `guide.md` are stored in `guide.md.mdb-comments.json`. MDB hides these sidecars from its explorer, but they remain normal JSON files that can be versioned, copied, and read by tools. Existing comments in `.mdb/comments.db` migrate lazily when each Markdown file is opened.

Sidecars include selected text, start/end line anchors, blocking state, threaded replies, authors, and timestamps. Line anchors are navigation hints; selected text remains the durable anchor if edits move content.

MDB installs its bundled `mdb-comments` agent skill when the app starts. The skill reads threads with `mdb comments list`, edits Markdown through the agent's normal file tools, replies with `mdb comments reply`, and changes blocking state only through `mdb comments block` or `mdb comments unblock`.

## Conversion Notes

- `html` produces sanitized standalone HTML.
- `rich-text` and `rtf` produce RTF readable by Word, Pages, LibreOffice, and other rich-text editors.
- `docx` produces native Office Open XML documents.
- `pdf` produces searchable text PDFs using built-in fonts. Unsupported glyphs are replaced because no external font files are bundled.
