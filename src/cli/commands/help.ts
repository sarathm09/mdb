export async function help(): Promise<void> {
  console.log(`mdb - Markdown Browser

Usage:
  mdb [directory]            Start the web UI (default: current directory)
  mdb serve [directory]      Start the web UI
  mdb convert <file>         Convert markdown to standalone HTML
  mdb copy <file>            Copy markdown as rich text to clipboard
  mdb present <file>         Generate a Reveal.js presentation from markdown
  mdb help                   Show this help message
  mdb version                Show version number

Options:
  --output, -o <file>        Output file path (for convert, present)
  --open                     Open in browser after generating (for present)
  --help, -h                 Show help
  --version, -v              Show version`);
}
