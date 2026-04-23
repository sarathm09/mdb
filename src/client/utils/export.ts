function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function cleanMarkdown(raw: string, stripSections: boolean): string {
  let output = raw;
  if (stripSections) {
    output = output.replace(/^[\t ]*(-{3,}|_{3,}|\*{3,})[\t ]*$/gm, '');
  }
  output = output.replace(/<\/?section[^>]*>/gi, '');
  output = output.replace(/<\/?b>/gi, (match) => match.toLowerCase() === '<b>' ? '**' : '**');
  output = output.replace(/<\/?i>/gi, (match) => match.toLowerCase() === '<i>' ? '*' : '*');
  output = output.replace(/<\/?strong>/gi, (match) => match.toLowerCase() === '<strong>' ? '**' : '**');
  output = output.replace(/<\/?em>/gi, (match) => match.toLowerCase() === '<em>' ? '*' : '*');
  output = output.replace(/<br\s*\/?>/gi, '\n');
  output = output.replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, '');
  output = output.replace(/\n{3,}/g, '\n\n');
  output = output.trim() + '\n';
  return output;
}

export function exportAsMarkdown(filePath: string, content: string, withSections: boolean): void {
  const output = cleanMarkdown(content, !withSections);
  const filename = filePath.split('/').pop() || 'document.md';
  downloadFile(output, filename, 'text/markdown');
}

export function exportAsHtml(filePath: string, htmlContent: string): void {
  const filename = (filePath.split('/').pop() || 'document').replace(/\.(md|markdown)$/i, '') + '.html';
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${filename.replace('.html', '')}</title>
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
  p { line-height: 1.7; margin-bottom: 16px; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  downloadFile(doc, filename, 'text/html');
}

export function printAsPdf(htmlContent?: string, title?: string): void {
  if (!htmlContent) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const doc = printWindow.document;
  doc.open();

  const html = doc.createElement('html');
  html.lang = 'en';

  const head = doc.createElement('head');
  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'UTF-8');
  head.appendChild(meta);

  const titleEl = doc.createElement('title');
  titleEl.textContent = title || 'Print';
  head.appendChild(titleEl);

  const style = doc.createElement('style');
  style.textContent = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.7;
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 32px;
      font-size: 15px;
      color: #1a1a1a;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
    h1 { font-size: 2em; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
    h2 { font-size: 1.5em; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
    h3 { font-size: 1.25em; }
    a { color: #0366d6; text-decoration: none; }
    code { font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace; font-size: 0.9em; }
    :not(pre) > code { background-color: #f6f8fa; padding: 2px 6px; border-radius: 3px; }
    pre { margin-bottom: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #ddd; }
    pre > code { padding: 16px; display: block; line-height: 1.5; font-size: 14px; background: #f6f8fa; }
    blockquote { border-left: 4px solid #ddd; padding: 8px 16px; color: #666; background: #f9f9f9; margin-bottom: 16px; }
    blockquote p:last-child { margin-bottom: 0; }
    ul, ol { padding-left: 24px; margin-bottom: 16px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #ddd; margin-bottom: 16px; }
    th { background-color: #f6f8fa; padding: 8px 12px; text-align: left; font-weight: 600; border: 1px solid #ddd; }
    td { padding: 8px 12px; border: 1px solid #ddd; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    img { max-width: 100%; }
    p { line-height: 1.7; margin-bottom: 16px; }
  `;
  head.appendChild(style);
  html.appendChild(head);

  const body = doc.createElement('body');
  body.innerHTML = htmlContent;
  html.appendChild(body);

  doc.appendChild(html);
  doc.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 500);
}

export async function copyAsMarkdown(content: string): Promise<boolean> {
  try {
    const cleaned = cleanMarkdown(content, false);
    await navigator.clipboard.writeText(cleaned);
    return true;
  } catch {
    return false;
  }
}

export async function copyAsRichText(htmlContent: string): Promise<boolean> {
  try {
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const plainText = doc.body.textContent || '';
    const plainBlob = new Blob([plainText], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': plainBlob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
