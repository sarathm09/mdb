import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { renderMarkdownToHtml } from "./markdown-renderer.js";

const require = createRequire(import.meta.url);

export function splitIntoSlides(content: string): string[] {
  const lines = content.split("\n");
  const slides: string[] = [];
  let current: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(`{3,}|~{3,})/.test(line.trimStart())) {
      inCodeFence = !inCodeFence;
    }
    if (!inCodeFence && /^(?:---+|\*\*\*+|___+)\s*$/.test(line) && current.length > 0) {
      slides.push(current.join("\n").trim());
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    const text = current.join("\n").trim();
    if (text) slides.push(text);
  }
  return slides;
}

function resolveRevealAsset(filename: string): string {
  const revealDir = path.dirname(require.resolve("reveal.js/package.json"));
  return readFileSync(path.join(revealDir, "dist", filename), "utf-8");
}

export function generatePresentation(mdContent: string, title: string): string {
  const slides = splitIntoSlides(mdContent);
  const slidesHtml = slides.map((s) => `        <section class="markdown-body">${renderMarkdownToHtml(s)}</section>`).join("\n");

  let revealCss: string;
  let revealJs: string;
  try {
    revealCss = resolveRevealAsset("reveal.css");
    revealJs = resolveRevealAsset("reveal.js");
  } catch {
    revealCss = "";
    revealJs = "";
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${revealCss}</style>
<style>
  :root {
    --bg-primary: #282c34;
    --bg-secondary: #21252b;
    --bg-tertiary: #2c313a;
    --text-primary: #abb2bf;
    --text-secondary: #636d83;
    --text-heading: #e5c07b;
    --accent-blue: #61afef;
    --accent-purple: #c678dd;
    --accent-green: #98c379;
    --accent-red: #e06c75;
    --accent-cyan: #56b6c2;
    --border: #3e4451;
  }
  .reveal { background: var(--bg-primary) !important; color: var(--text-primary); }
  .reveal h1, .reveal h2, .reveal h3, .reveal h4, .reveal h5, .reveal h6 { color: var(--text-heading) !important; }
  .reveal a { color: var(--accent-blue) !important; }
  .reveal pre code { background: var(--bg-tertiary); }
  .reveal .controls { color: var(--accent-blue) !important; }
  .reveal .progress { color: var(--accent-blue) !important; }
  .reveal .slide-number { color: var(--text-secondary); background: var(--bg-secondary); }
  .reveal .slides { text-align: left; }
  .reveal .slides section { text-align: left; }
  code {
    font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: 0.9em;
  }
  :not(pre) > code {
    background-color: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--accent-red);
  }
  pre {
    margin-bottom: 16px;
    border-radius: 8px;
    overflow-x: auto;
  }
  pre > code {
    padding: 16px;
    display: block;
    line-height: 1.5;
    font-size: 14px;
    border-radius: 8px;
    background-color: var(--bg-secondary);
  }
  blockquote {
    border-left: 4px solid var(--accent-purple);
    padding: 8px 16px;
    color: var(--text-secondary);
    background-color: var(--bg-tertiary);
    border-radius: 0 4px 4px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--border);
  }
  th {
    background-color: var(--bg-secondary);
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    border: 1px solid var(--border);
  }
  td { padding: 8px 12px; border: 1px solid var(--border); }
  img { max-width: 100%; border-radius: 8px; }
</style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <script>${revealJs}</script>
  <script>
    Reveal.initialize({
      hash: true,
      transition: 'slide',
      backgroundTransition: 'fade',
      controls: true,
      progress: true,
      center: true,
      slideNumber: 'h.v',
      width: 1280,
      height: 720,
      margin: 0.04,
    });
  </script>
</body>
</html>`;
}
