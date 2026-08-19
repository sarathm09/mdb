import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const window = new Window();
Object.assign(globalThis, {
  window,
  document: window.document,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  DOMParser: window.DOMParser,
});

const { renderMarkdown } = await import("./markdown-renderer");

describe("renderMarkdown line annotations", () => {
  test("maps blocks to their source lines", async () => {
    const html = await renderMarkdown("# Review\n\nSelect this sentence.\n", ".", true);

    expect(html).toContain('<h1 data-source-line="1"');
    expect(html).toContain('<p data-source-line="3"');
  });

  test("highlights fenced code and accepts filename suffixes", async () => {
    const html = await renderMarkdown("```ts#index.ts\nconst answer = 42;\n```", ".", true);

    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).not.toContain('<code class="hljs language-ts">\n');
  });
});
