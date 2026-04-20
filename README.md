# Markdown Browser

A CLI tool that opens a web-based file explorer for browsing, creating, viewing, and editing markdown files in any directory. Features presentation mode, multiple themes, export options, syntax-highlighted code blocks, mermaid diagram support, and a full CodeMirror editor.

## Quick Start

Run directly without installing:

```bash
npx @sarathm09/mdb [directory]
bunx @sarathm09/mdb [directory]
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
  - Syntax-highlighted code blocks (highlight.js)
  - Mermaid diagrams (lazy-loaded)
  - Tables, task lists, blockquotes, links, images
  - DOMPurify sanitization for security
- **Markdown Editor** - CodeMirror 6 with:
  - Theme-aware syntax highlighting
  - Markdown syntax highlighting
  - Language-aware code block highlighting
  - Cmd/Ctrl+S to save
  - Unsaved changes indicator
- **Toggle Mode** - Switch between Preview and Edit with a button
- **Create Files** - New markdown file dialog with auto `.md` extension
- **Presentation Mode** - Turn any markdown file into a slide deck with keyboard navigation
- **Export Features** - Export files as Markdown, HTML, or PDF; export presentations as PNG zip or PDF
- **Themes** - 5 available themes: One Dark, Tokyo Night, Catppuccin Mocha, GitHub Dark, GitHub Light
- **Command Palette** - Quick file search and actions via `Cmd+Shift+P`
- **Keyboard Shortcuts** - Comprehensive shortcuts for navigation, editing, and presentation
- **Security** - Path traversal protection (can't navigate above root directory)

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
| One Dark | Dark, warm tones |
| Tokyo Night | Dark, cool blue tones |
| Catppuccin Mocha | Dark, pastel palette |
| GitHub Dark | Dark, GitHub-inspired |
| GitHub Light | Light, GitHub-inspired |

## Keyboard Shortcuts

Press `?` at any time to open the shortcuts help modal.

### General

| Shortcut | Action |
|----------|--------|
| `Cmd+D` | Toggle sidebar |
| `Cmd+Shift+P` | Command palette |
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
