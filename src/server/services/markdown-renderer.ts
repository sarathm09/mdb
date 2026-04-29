import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

export function renderMarkdownToHtml(content: string): string {
  const marked = new Marked(
    markedHighlight({
      emptyLangClass: "hljs",
      langPrefix: "hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    })
  );
  marked.setOptions({ gfm: true, breaks: true });
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, "    ");
  return marked.parse(normalized) as string;
}

const STANDALONE_CSS = `  :root {
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
    --accent-yellow: #e5c07b;
    --accent-cyan: #56b6c2;
    --border: #3e4451;
  }
  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.7;
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 32px;
    font-size: 15px;
  }
  h1, h2, h3, h4, h5, h6 {
    color: var(--text-heading);
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
  }
  h1 { font-size: 2em; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  h2 { font-size: 1.5em; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
  h3 { font-size: 1.25em; }
  a { color: var(--accent-blue); text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { color: var(--text-primary); font-weight: 600; }
  em { color: var(--accent-cyan); }
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
    margin-bottom: 16px;
  }
  blockquote p:last-child { margin-bottom: 0; }
  ul, ol { padding-left: 24px; margin-bottom: 16px; }
  li { margin-bottom: 4px; }
  table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--border);
    margin-bottom: 16px;
  }
  th {
    background-color: var(--bg-secondary);
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    border: 1px solid var(--border);
  }
  td {
    padding: 8px 12px;
    border: 1px solid var(--border);
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
  img { max-width: 100%; border-radius: 8px; }
  p { line-height: 1.7; margin-bottom: 16px; }`;

export function renderMarkdownToStandaloneHtml(content: string, title: string): string {
  const body = renderMarkdownToHtml(content);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${STANDALONE_CSS}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
