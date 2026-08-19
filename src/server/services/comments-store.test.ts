import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { CommentsStore } from "./comments-store";

let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "mdb-comments-"));
  await writeFile(path.join(rootDir, "review.md"), "# Review\n\nSome text");
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("CommentsStore", () => {
  test("persists comments beside their Markdown file", async () => {
    const store = new CommentsStore(rootDir);
    const comment = store.create({
      filePath: "review.md",
      body: "Needs revision",
      sourceLine: 3,
      sourceEndLine: 3,
      selectionText: "Some text",
      blocking: true,
    });

    const sidecar = JSON.parse(await readFile(path.join(rootDir, "review.md.mdb-comments.json"), "utf8"));
    expect(sidecar.version).toBe(1);
    expect(sidecar.filePath).toBe("review.md");
    expect(sidecar.comments[0].id).toBe(comment.id);
    expect(sidecar.comments[0].blocking).toBe(true);
    store.close();
  });

  test("stores replies and updates blocking state", () => {
    const store = new CommentsStore(rootDir);
    const parent = store.create({ filePath: "review.md", body: "Question" });
    const reply = store.create({ filePath: "review.md", parentId: parent.id, body: "Answer", author: "ai" });
    const updated = store.update(parent.id, { filePath: "review.md", blocking: true });

    expect(store.getByFile("review.md")).toHaveLength(2);
    expect(reply.parentId).toBe(parent.id);
    expect(updated?.blocking).toBe(true);
    store.close();
  });

  test("stores nested replies and deletes all descendants", () => {
    const store = new CommentsStore(rootDir);
    const parent = store.create({ filePath: "review.md", body: "Question" });
    const reply = store.create({ filePath: "review.md", parentId: parent.id, body: "Answer" });
    const nestedReply = store.create({ filePath: "review.md", parentId: reply.id, body: "Follow-up" });

    expect(nestedReply.parentId).toBe(reply.id);
    expect(store.getByFile("review.md")).toHaveLength(3);
    expect(store.delete(reply.id, "review.md")).toBe(true);
    expect(store.getByFile("review.md").map(comment => comment.id)).toEqual([parent.id]);
    store.close();
  });

  test("deleting a thread also deletes replies and empty sidecar", async () => {
    const store = new CommentsStore(rootDir);
    const parent = store.create({ filePath: "review.md", body: "Question" });
    store.create({ filePath: "review.md", parentId: parent.id, body: "Answer" });
    expect(store.delete(parent.id, "review.md")).toBe(true);
    expect(store.getByFile("review.md")).toEqual([]);
    expect(await Bun.file(path.join(rootDir, "review.md.mdb-comments.json")).exists()).toBe(false);
    store.close();
  });

  test("rejects traversal and invalid line ranges", () => {
    const store = new CommentsStore(rootDir);
    expect(() => store.create({ filePath: "../outside.md", body: "No" })).toThrow("Path traversal");
    expect(() => store.create({ filePath: "review.md", body: "No", sourceLine: 5, sourceEndLine: 4 })).toThrow("end line");
    store.close();
  });
});
