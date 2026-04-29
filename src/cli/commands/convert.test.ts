import { describe, test, expect } from "vitest";
import { renderMarkdownToHtml, renderMarkdownToStandaloneHtml } from "../../server/services/markdown-renderer.js";

describe("renderMarkdownToHtml", () => {
  test("renders basic markdown to HTML", () => {
    const result = renderMarkdownToHtml("# Hello\n\nWorld");
    expect(result).toContain("<h1");
    expect(result).toContain("Hello");
    expect(result).toContain("<p>World");
  });

  test("renders code blocks with syntax highlighting", () => {
    const result = renderMarkdownToHtml("```js\nconst x = 1;\n```");
    expect(result).toContain("<pre>");
    expect(result).toContain("<code");
    expect(result).toContain("hljs");
  });

  test("renders GFM tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const result = renderMarkdownToHtml(md);
    expect(result).toContain("<table>");
    expect(result).toContain("<th>");
    expect(result).toContain("<td>");
  });

  test("renders links", () => {
    const result = renderMarkdownToHtml("[click](https://example.com)");
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain("click");
  });
});

describe("renderMarkdownToStandaloneHtml", () => {
  test("wraps in full HTML document", () => {
    const result = renderMarkdownToStandaloneHtml("# Test", "Test Doc");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html");
    expect(result).toContain("<head>");
    expect(result).toContain("<body>");
    expect(result).toContain("</html>");
  });

  test("includes title in document", () => {
    const result = renderMarkdownToStandaloneHtml("# Test", "My Title");
    expect(result).toContain("<title>My Title</title>");
  });

  test("includes CSS styles", () => {
    const result = renderMarkdownToStandaloneHtml("# Test", "Test");
    expect(result).toContain("--bg-primary");
    expect(result).toContain("--text-primary");
    expect(result).toContain("<style>");
  });

  test("includes rendered markdown in body", () => {
    const result = renderMarkdownToStandaloneHtml("**bold text**", "Test");
    expect(result).toContain("<strong>bold text</strong>");
  });
});
