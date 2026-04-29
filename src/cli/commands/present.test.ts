import { describe, test, expect } from "vitest";
import { splitIntoSlides, generatePresentation } from "../../server/services/presentation-generator.js";

describe("splitIntoSlides", () => {
  test("splits on --- separator", () => {
    const slides = splitIntoSlides("Slide 1\n---\nSlide 2\n---\nSlide 3");
    expect(slides).toHaveLength(3);
    expect(slides[0]).toBe("Slide 1");
    expect(slides[1]).toBe("Slide 2");
    expect(slides[2]).toBe("Slide 3");
  });

  test("splits on *** separator", () => {
    const slides = splitIntoSlides("Slide 1\n***\nSlide 2");
    expect(slides).toHaveLength(2);
  });

  test("splits on ___ separator", () => {
    const slides = splitIntoSlides("Slide 1\n___\nSlide 2");
    expect(slides).toHaveLength(2);
  });

  test("does not split inside code fences", () => {
    const content = "Before\n```\n---\n```\nAfter";
    const slides = splitIntoSlides(content);
    expect(slides).toHaveLength(1);
  });

  test("returns single slide for content without separators", () => {
    const slides = splitIntoSlides("# Hello\n\nWorld");
    expect(slides).toHaveLength(1);
    expect(slides[0]).toBe("# Hello\n\nWorld");
  });

  test("ignores empty trailing content", () => {
    const slides = splitIntoSlides("Slide 1\n---\n   \n");
    expect(slides).toHaveLength(1);
  });
});

describe("generatePresentation", () => {
  test("produces valid HTML document", () => {
    const html = generatePresentation("# Slide 1\n---\n# Slide 2", "Test");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("includes Reveal.js initialization", () => {
    const html = generatePresentation("# Test", "Test");
    expect(html).toContain("Reveal.initialize");
  });

  test("includes slide sections", () => {
    const html = generatePresentation("Slide 1\n---\nSlide 2", "Test");
    const sectionCount = (html.match(/<section class="markdown-body">/g) || []).length;
    expect(sectionCount).toBe(2);
  });

  test("includes theme CSS variables", () => {
    const html = generatePresentation("# Test", "Test");
    expect(html).toContain("--bg-primary");
    expect(html).toContain("--text-heading");
    expect(html).toContain("--accent-blue");
  });

  test("includes title", () => {
    const html = generatePresentation("# Test", "My Presentation");
    expect(html).toContain("<title>My Presentation</title>");
  });
});
