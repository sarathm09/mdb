import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { Marked, type Token, type Tokens } from "marked";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sanitizeHtml from "sanitize-html";

export type ConversionFormat = "html" | "rtf" | "docx" | "pdf";

interface TextStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
}

interface TextPiece extends TextStyle {
  text: string;
}

interface DocumentBlock {
  kind: "paragraph" | "heading" | "code" | "quote" | "list" | "table" | "rule";
  level?: number;
  ordered?: boolean;
  pieces?: TextPiece[];
  text?: string;
  rows?: string[][];
}

const marked = new Marked({ gfm: true, breaks: true });

export function parseConversionFormat(value: string): ConversionFormat {
  if (value === "rich-text" || value === "richtext") return "rtf";
  if (value === "html" || value === "rtf" || value === "docx" || value === "pdf") return value;
  throw new Error(`Unsupported format: ${value}. Use html, rtf, rich-text, docx, or pdf.`);
}

export function defaultOutputPath(inputPath: string, format: ConversionFormat): string {
  const extension = path.extname(inputPath);
  const base = extension ? inputPath.slice(0, -extension.length) : inputPath;
  return `${base}.${format}`;
}

export async function convertMarkdownFile(
  inputPath: string,
  outputPath: string,
  format: ConversionFormat,
): Promise<void> {
  if (!/\.(md|markdown)$/i.test(inputPath)) throw new Error("Input must be a Markdown file");
  const markdown = await readFile(inputPath, "utf8");
  const title = path.basename(inputPath).replace(/\.(md|markdown)$/i, "");
  let output: string | Uint8Array;

  switch (format) {
    case "html":
      output = markdownToHtml(markdown, title);
      break;
    case "rtf":
      output = markdownToRtf(markdown);
      break;
    case "docx":
      output = await markdownToDocx(markdown, title);
      break;
    case "pdf":
      output = await markdownToPdf(markdown, title);
      break;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
}

export function markdownToHtml(markdown: string, title = "Document"): string {
  const rendered = marked.parse(markdown) as string;
  const body = sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "details", "summary"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      input: ["type", "checked", "disabled"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  });
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
  body { max-width: 850px; margin: 40px auto; padding: 0 24px; color: #202124; font: 16px/1.65 system-ui, sans-serif; }
  h1, h2 { border-bottom: 1px solid #dfe2e5; padding-bottom: .3em; }
  pre { overflow: auto; padding: 16px; background: #f6f8fa; border-radius: 6px; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  :not(pre) > code { padding: .15em .35em; background: #f1f3f4; border-radius: 3px; }
  blockquote { margin-left: 0; padding-left: 16px; color: #5f6368; border-left: 4px solid #dadce0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 12px; border: 1px solid #dadce0; text-align: left; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function markdownToRtf(markdown: string): string {
  const blocks = markdownBlocks(markdown);
  const body = blocks.map((block) => {
    const text = blockText(block);
    switch (block.kind) {
      case "heading": {
        const size = Math.max(28, 48 - ((block.level ?? 1) - 1) * 4);
        return `\\pard\\sa240\\b\\fs${size} ${rtfEscape(text)}\\b0\\par`;
      }
      case "code":
        return `\\pard\\li360\\sa180\\f1\\fs20 ${rtfEscape(text)}\\f0\\fs24\\par`;
      case "quote":
        return `\\pard\\li540\\ri360\\sa180\\i ${rtfEscape(text)}\\i0\\par`;
      case "list":
        return `\\pard\\li540\\fi-270\\sa100 ${block.ordered ? "1." : "\\bullet"}\\tab ${rtfEscape(text)}\\par`;
      case "table":
        return (block.rows ?? []).map((row) => `\\pard ${row.map(rtfEscape).join("\\tab ")}\\par`).join("\n");
      case "rule":
        return "\\pard\\brdrb\\brdrs\\brdrw10\\sa240 \\par";
      default:
        return `\\pard\\sa180 ${piecesToRtf(block.pieces ?? [{ text }])}\\par`;
    }
  }).join("\n");
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}{\\f1 Courier New;}}\\viewkind4\\uc1\\fs24
${body}
}`;
}

export async function markdownToDocx(markdown: string, title = "Document"): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  for (const block of markdownBlocks(markdown)) {
    switch (block.kind) {
      case "heading":
        children.push(new Paragraph({
          heading: headingLevel(block.level ?? 1),
          children: piecesToDocx(block.pieces ?? [{ text: block.text ?? "" }]),
        }));
        break;
      case "code":
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text ?? "", font: "Courier New", size: 20 })],
          spacing: { before: 120, after: 120 },
        }));
        break;
      case "quote":
        children.push(new Paragraph({
          children: [new TextRun({ text: blockText(block), italics: true, color: "5F6368" })],
          indent: { left: 720 },
        }));
        break;
      case "list":
        children.push(new Paragraph({
          bullet: block.ordered ? undefined : { level: 0 },
          children: [new TextRun(`${block.ordered ? "1. " : ""}${blockText(block)}`)],
        }));
        break;
      case "table":
        for (const row of block.rows ?? []) {
          children.push(new Paragraph({ children: [new TextRun(row.join(" | "))] }));
        }
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun("________________________________________")] }));
        break;
      default:
        children.push(new Paragraph({ children: piecesToDocx(block.pieces ?? []) }));
    }
  }

  const document = new Document({
    title,
    creator: "mdb",
    sections: [{ properties: {}, children }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

export async function markdownToPdf(markdown: string, title = "Document"): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setCreator("mdb");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const mono = await document.embedFont(StandardFonts.Courier);
  const state = createPdfPage(document);

  for (const block of markdownBlocks(markdown)) {
    if (block.kind === "rule") {
      ensurePdfSpace(document, state, 22);
      state.page.drawLine({ start: { x: 54, y: state.y }, end: { x: 558, y: state.y }, color: rgb(0.8, 0.8, 0.8) });
      state.y -= 20;
      continue;
    }
    const text = pdfSafeText(blockText(block));
    if (!text) { state.y -= 8; continue; }
    const style = pdfStyle(block, regular, bold, italic, mono);
    const lines = wrapPdfText(text, style.font, style.size, 504 - style.indent);
    ensurePdfSpace(document, state, lines.length * style.lineHeight + style.after);
    for (const line of lines) {
      state.page.drawText(line, {
        x: 54 + style.indent,
        y: state.y,
        size: style.size,
        font: style.font,
        color: style.color,
      });
      state.y -= style.lineHeight;
    }
    state.y -= style.after;
  }
  return document.save();
}

function markdownBlocks(markdown: string): DocumentBlock[] {
  return tokensToBlocks(marked.lexer(markdown));
}

function tokensToBlocks(tokens: Token[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        blocks.push({ kind: "heading", level: heading.depth, pieces: inlinePieces(heading.tokens) });
        break;
      }
      case "paragraph": {
        const paragraph = token as Tokens.Paragraph;
        blocks.push({ kind: "paragraph", pieces: inlinePieces(paragraph.tokens) });
        break;
      }
      case "text": {
        const text = token as Tokens.Text;
        blocks.push({ kind: "paragraph", pieces: inlinePieces(text.tokens ?? [text]) });
        break;
      }
      case "code":
        blocks.push({ kind: "code", text: (token as Tokens.Code).text });
        break;
      case "blockquote": {
        const quote = token as Tokens.Blockquote;
        blocks.push({ kind: "quote", text: tokensToBlocks(quote.tokens).map(blockText).join("\n") });
        break;
      }
      case "list": {
        const list = token as Tokens.List;
        for (const item of list.items) {
          blocks.push({ kind: "list", ordered: list.ordered, text: tokensToBlocks(item.tokens).map(blockText).join(" ") });
        }
        break;
      }
      case "table": {
        const table = token as Tokens.Table;
        blocks.push({
          kind: "table",
          rows: [table.header.map((cell) => inlineText(cell.tokens)), ...table.rows.map((row) => row.map((cell) => inlineText(cell.tokens)))],
        });
        break;
      }
      case "hr":
        blocks.push({ kind: "rule" });
        break;
    }
  }
  return blocks;
}

function inlinePieces(tokens: Token[] = [], style: TextStyle = {}): TextPiece[] {
  const pieces: TextPiece[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "strong":
        pieces.push(...inlinePieces((token as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        pieces.push(...inlinePieces((token as Tokens.Em).tokens, { ...style, italics: true }));
        break;
      case "codespan":
        pieces.push({ text: (token as Tokens.Codespan).text, ...style, code: true });
        break;
      case "link":
        pieces.push(...inlinePieces((token as Tokens.Link).tokens, style));
        break;
      case "image":
        pieces.push({ text: (token as Tokens.Image).text || "[image]", ...style, italics: true });
        break;
      case "br":
        pieces.push({ text: "\n", ...style });
        break;
      case "del":
        pieces.push(...inlinePieces((token as Tokens.Del).tokens, style));
        break;
      default: {
        const value = token as Token & { text?: string; tokens?: Token[] };
        if (value.tokens) pieces.push(...inlinePieces(value.tokens, style));
        else if (value.text) pieces.push({ text: value.text, ...style });
      }
    }
  }
  return pieces;
}

function inlineText(tokens: Token[] = []): string {
  return inlinePieces(tokens).map((piece) => piece.text).join("");
}

function blockText(block: DocumentBlock): string {
  if (block.rows) return block.rows.map((row) => row.join(" | ")).join("\n");
  if (block.pieces) return block.pieces.map((piece) => piece.text).join("");
  return block.text ?? "";
}

function piecesToDocx(pieces: TextPiece[]): TextRun[] {
  return pieces.map((piece) => new TextRun({
    text: piece.text,
    bold: piece.bold,
    italics: piece.italics,
    font: piece.code ? "Courier New" : undefined,
  }));
}

function piecesToRtf(pieces: TextPiece[]): string {
  return pieces.map((piece) => {
    let prefix = "";
    let suffix = "";
    if (piece.bold) { prefix += "\\b "; suffix = `\\b0 ${suffix}`; }
    if (piece.italics) { prefix += "\\i "; suffix = `\\i0 ${suffix}`; }
    if (piece.code) { prefix += "\\f1 "; suffix = `\\f0 ${suffix}`; }
    return `${prefix}${rtfEscape(piece.text)}${suffix}`;
  }).join("");
}

function rtfEscape(value: string): string {
  let output = "";
  for (const character of value) {
    if (character === "\\" || character === "{" || character === "}") output += `\\${character}`;
    else if (character === "\n") output += "\\line ";
    else if (character.charCodeAt(0) > 127) {
      for (let index = 0; index < character.length; index++) {
        const code = character.charCodeAt(index);
        output += `\\u${code > 32767 ? code - 65536 : code}?`;
      }
    } else output += character;
  }
  return output;
}

function headingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
  return levels[Math.max(0, Math.min(5, level - 1))]!;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

interface PdfState { page: PDFPage; y: number }

function createPdfPage(document: PDFDocument): PdfState {
  return { page: document.addPage([612, 792]), y: 738 };
}

function ensurePdfSpace(document: PDFDocument, state: PdfState, required: number): void {
  if (state.y - required >= 54) return;
  const next = createPdfPage(document);
  state.page = next.page;
  state.y = next.y;
}

function pdfStyle(block: DocumentBlock, regular: PDFFont, bold: PDFFont, italic: PDFFont, mono: PDFFont) {
  if (block.kind === "heading") {
    const size = Math.max(15, 26 - ((block.level ?? 1) - 1) * 2);
    return { font: bold, size, lineHeight: size * 1.2, after: 10, indent: 0, color: rgb(0.12, 0.13, 0.14) };
  }
  if (block.kind === "code") return { font: mono, size: 9, lineHeight: 12, after: 10, indent: 18, color: rgb(0.15, 0.16, 0.18) };
  if (block.kind === "quote") return { font: italic, size: 11, lineHeight: 15, after: 9, indent: 24, color: rgb(0.35, 0.37, 0.4) };
  if (block.kind === "list") return { font: regular, size: 11, lineHeight: 15, after: 4, indent: 18, color: rgb(0.12, 0.13, 0.14) };
  return { font: regular, size: 11, lineHeight: 16, after: 8, indent: 0, color: rgb(0.12, 0.13, 0.14) };
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const sourceLine of text.split("\n")) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) line = word;
        else {
          let chunk = "";
          for (const character of word) {
            if (font.widthOfTextAtSize(chunk + character, size) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = character;
            } else chunk += character;
          }
          line = chunk;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function pdfSafeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\xFF\n]/g, "?");
}
