export interface FrontmatterData {
  raw: string;
  entries: [string, string][];
}

export function parseFrontmatter(content: string): { frontmatter: FrontmatterData | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  const raw = match[1];
  const body = match[2];
  const entries: [string, string][] = [];
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key) entries.push([key, value]);
    }
  }
  return { frontmatter: { raw, entries }, body };
}
