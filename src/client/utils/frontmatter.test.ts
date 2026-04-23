import { describe, test, expect } from "bun:test";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  test("parses valid frontmatter", () => {
    const input = `---
title: My Document
author: John
---
# Content here`;
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter!.entries).toEqual([
      ["title", "My Document"],
      ["author", "John"],
    ]);
    expect(body).toBe("# Content here");
  });

  test("returns null frontmatter for content without frontmatter", () => {
    const input = "# Just a heading\nSome text";
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).toBeNull();
    expect(body).toBe(input);
  });

  test("returns null for empty string", () => {
    const { frontmatter, body } = parseFrontmatter("");
    expect(frontmatter).toBeNull();
    expect(body).toBe("");
  });

  test("preserves raw frontmatter string", () => {
    const input = `---
title: Test
---
Body`;
    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter!.raw).toBe("title: Test");
  });

  test("strips quotes from values", () => {
    const input = `---
title: "Quoted Title"
author: 'Single Quoted'
---
Body`;
    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter!.entries).toEqual([
      ["title", "Quoted Title"],
      ["author", "Single Quoted"],
    ]);
  });

  test("handles values with colons", () => {
    const input = `---
url: https://example.com
---
Body`;
    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter!.entries).toEqual([["url", "https://example.com"]]);
  });

  test("handles empty values", () => {
    const input = `---
title:
---
Body`;
    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter!.entries).toEqual([["title", ""]]);
  });

  test("handles Windows-style line endings", () => {
    const input = "---\r\ntitle: Test\r\n---\r\nBody content";
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter!.entries).toEqual([["title", "Test"]]);
    expect(body).toBe("Body content");
  });

  test("ignores lines without colon", () => {
    const input = `---
title: Valid
just some text
author: Also Valid
---
Body`;
    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter!.entries).toEqual([
      ["title", "Valid"],
      ["author", "Also Valid"],
    ]);
  });

  test("handles frontmatter with no body", () => {
    const input = `---
title: Test
---
`;
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).not.toBeNull();
    expect(body).toBe("");
  });

  test("does not match frontmatter not at start of file", () => {
    const input = `Some text
---
title: Test
---
More text`;
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).toBeNull();
    expect(body).toBe(input);
  });

  test("handles multiple entries", () => {
    const input = `---
title: Doc
author: Alice
date: 2024-01-01
tags: test, example
draft: true
---
Content`;
    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter!.entries).toHaveLength(5);
  });
});
