// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanMarkdown } from "./export";

describe("cleanMarkdown", () => {
  test("strips section dividers when stripSections is true", () => {
    const input = "# Title\n---\nContent\n___\nMore";
    const result = cleanMarkdown(input, true);
    expect(result).not.toContain("---");
    expect(result).not.toContain("___");
    expect(result).toContain("# Title");
    expect(result).toContain("Content");
  });

  test("preserves section dividers when stripSections is false", () => {
    const input = "# Title\n---\nContent";
    const result = cleanMarkdown(input, false);
    expect(result).toContain("---");
  });

  test("removes <section> tags", () => {
    const input = '<section class="slide">Content</section>';
    const result = cleanMarkdown(input, false);
    expect(result).not.toContain("<section");
    expect(result).not.toContain("</section>");
    expect(result).toContain("Content");
  });

  test("converts <b> and <strong> to markdown bold", () => {
    const input = "<b>bold</b> and <strong>strong</strong>";
    const result = cleanMarkdown(input, false);
    expect(result).toContain("**bold**");
    expect(result).toContain("**strong**");
  });

  test("converts <i> and <em> to markdown italic", () => {
    const input = "<i>italic</i> and <em>emphasis</em>";
    const result = cleanMarkdown(input, false);
    expect(result).toContain("*italic*");
    expect(result).toContain("*emphasis*");
  });

  test("converts <br> to newlines", () => {
    const input = "line1<br>line2<br/>line3<br />line4";
    const result = cleanMarkdown(input, false);
    expect(result).toContain("line1\nline2\nline3\nline4");
  });

  test("strips remaining HTML tags", () => {
    const input = '<div class="test"><p>Hello</p><span>World</span></div>';
    const result = cleanMarkdown(input, false);
    expect(result).not.toContain("<div");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<span>");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  test("collapses multiple blank lines", () => {
    const input = "line1\n\n\n\n\nline2";
    const result = cleanMarkdown(input, false);
    expect(result).not.toMatch(/\n{3,}/);
  });

  test("trims and adds trailing newline", () => {
    const input = "  content  ";
    const result = cleanMarkdown(input, false);
    expect(result).toBe("content\n");
  });

  test("handles empty input", () => {
    const result = cleanMarkdown("", false);
    expect(result).toBe("\n");
  });

  test("handles complex mixed content", () => {
    const input =
      '<section><b>Title</b><br><i>Subtitle</i></section>\n---\n<p>Body</p>';
    const result = cleanMarkdown(input, true);
    expect(result).toContain("**Title**");
    expect(result).toContain("*Subtitle*");
    expect(result).toContain("Body");
    expect(result).not.toContain("<section>");
    expect(result).not.toContain("<p>");
  });

  test("handles asterisk-style dividers", () => {
    const input = "Above\n***\nBelow";
    const result = cleanMarkdown(input, true);
    expect(result).not.toContain("***");
  });
});

describe("DOM-dependent export functions", () => {
  test("exportAsMarkdown triggers download with correct filename", async () => {
    const { exportAsMarkdown } = await import("./export");
    let downloadedName = "";

    const origCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: () => {
          downloadedName = (el as any).download;
        }});
      }
      return el;
    }) as typeof document.createElement;

    exportAsMarkdown("docs/readme.md", "# Hello\n---\nWorld", false);
    expect(downloadedName).toBe("readme.md");
  });

  test("exportAsHtml generates correct HTML document", async () => {
    const { exportAsHtml } = await import("./export");
    let lastCreatedAnchor: any = null;

    const origCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        lastCreatedAnchor = el;
      }
      return el;
    }) as typeof document.createElement;

    exportAsHtml("docs/page.md", "<h1>Hello</h1>");
    expect(lastCreatedAnchor).not.toBeNull();
    expect(lastCreatedAnchor.download).toBe("page.html");
  });

  test("printAsPdf calls window.print when no content provided", async () => {
    const { printAsPdf } = await import("./export");
    let printed = false;
    (window as any).print = () => { printed = true; };
    printAsPdf();
    expect(printed).toBe(true);
  });

  test("printAsPdf calls window.print when open returns null", async () => {
    const { printAsPdf } = await import("./export");
    let printed = false;
    (window as any).print = () => { printed = true; };
    (window as any).open = () => null;
    printAsPdf("<p>Content</p>", "Test");
    expect(printed).toBe(true);
  });

  test("printAsPdf opens new window and writes HTML when content provided", async () => {
    const { printAsPdf } = await import("./export");
    let writtenHtml = "";
    let printCalled = false;
    let focusCalled = false;
    const fakeDoc = {
      open: () => {},
      close: () => {},
      createElement: (tag: string) => {
        const el: Record<string, any> = { tagName: tag, childNodes: [], children: [] };
        el.setAttribute = () => {};
        el.appendChild = (child: any) => { el.children.push(child); };
        if (tag === "style") {
          Object.defineProperty(el, "textContent", {
            set: (v: string) => { el._text = v; },
            get: () => el._text || "",
          });
        }
        if (tag === "body") {
          Object.defineProperty(el, "innerHTML", {
            set: (v: string) => { writtenHtml = v; },
            get: () => writtenHtml,
          });
        }
        return el;
      },
      appendChild: () => {},
    };
    const fakeWindow = {
      document: fakeDoc,
      focus: () => { focusCalled = true; },
      print: () => { printCalled = true; },
      close: () => {},
      onload: null as any,
    };
    (window as any).open = () => fakeWindow;
    printAsPdf("<h1>Test</h1>", "Test Title");

    if (fakeWindow.onload) {
      fakeWindow.onload(new Event("load"));
    }

    await new Promise((r) => setTimeout(r, 600));

    expect(writtenHtml).toContain("<h1>Test</h1>");
    expect(focusCalled).toBe(true);
    expect(printCalled).toBe(true);
  });

  test("copyAsMarkdown copies cleaned text to clipboard", async () => {
    const { copyAsMarkdown } = await import("./export");
    let copiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => { copiedText = text; } },
      configurable: true,
    });
    const result = await copyAsMarkdown("<b>Hello</b> World");
    expect(result).toBe(true);
    expect(copiedText).toContain("**Hello**");
    expect(copiedText).toContain("World");
  });

  test("copyAsMarkdown returns false on clipboard failure", async () => {
    const { copyAsMarkdown } = await import("./export");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => { throw new Error("denied"); } },
      configurable: true,
    });
    const result = await copyAsMarkdown("test");
    expect(result).toBe(false);
  });

  test("copyAsRichText copies HTML and plain text", async () => {
    const { copyAsRichText } = await import("./export");
    let writtenItems: any[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async (items: any[]) => { writtenItems = items; },
      },
      configurable: true,
    });
    (globalThis as any).ClipboardItem = class {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) { this.items = items; }
    };
    const result = await copyAsRichText("<p>Hello World</p>");
    expect(result).toBe(true);
    expect(writtenItems).toHaveLength(1);
  });

  test("copyAsRichText returns false on clipboard failure", async () => {
    const { copyAsRichText } = await import("./export");
    Object.defineProperty(navigator, "clipboard", {
      value: { write: async () => { throw new Error("denied"); } },
      configurable: true,
    });
    (globalThis as any).ClipboardItem = class {
      constructor(items: any) {}
    };
    const result = await copyAsRichText("<p>Test</p>");
    expect(result).toBe(false);
  });
});
