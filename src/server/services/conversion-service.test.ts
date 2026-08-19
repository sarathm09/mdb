import { describe, expect, test } from "bun:test";
import { markdownToDocx, markdownToHtml, markdownToPdf, markdownToRtf, parseConversionFormat } from "./conversion-service";

const SAMPLE = `# Test Document

This has **bold**, *italic*, and \`code\`.

- First
- Second

| Name | Value |
| --- | --- |
| A | 1 |
`;

describe("conversion-service", () => {
  test("maps rich-text to RTF", () => {
    expect(parseConversionFormat("rich-text")).toBe("rtf");
  });

  test("creates sanitized standalone HTML", () => {
    const html = markdownToHtml(`${SAMPLE}\n<script>alert(1)</script>`, "Test");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<script>");
  });

  test("creates RTF with formatted content", () => {
    const rtf = markdownToRtf(SAMPLE);
    expect(rtf.startsWith("{\\rtf1")).toBe(true);
    expect(rtf).toContain("Test Document");
    expect(rtf).toContain("\\bullet");
  });

  test("creates valid DOCX bytes", async () => {
    const docx = await markdownToDocx(SAMPLE, "Test");
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
  });

  test("creates valid PDF bytes", async () => {
    const pdf = await markdownToPdf(SAMPLE, "Test");
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
