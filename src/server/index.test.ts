import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startServer } from "./index";

let rootDir: string | undefined;
let distDir: string | undefined;
let server: ReturnType<typeof import("@hono/node-server").serve> | undefined;

afterEach(async () => {
  server?.close();
  server = undefined;
  if (rootDir) await rm(rootDir, { recursive: true, force: true });
  if (distDir) await rm(distDir, { recursive: true, force: true });
  rootDir = undefined;
  distDir = undefined;
});

describe("startServer", () => {
  test("serves SPA and static assets from dist directory", async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "mdb-server-root-"));
    distDir = await mkdtemp(path.join(tmpdir(), "mdb-server-dist-"));
    await mkdir(path.join(distDir, "styles"));
    await writeFile(path.join(distDir, "index.html"), "<main>MDB</main>");
    await writeFile(path.join(distDir, "main.js"), "console.log('mdb')");
    await writeFile(path.join(distDir, "styles", "global.css"), "body { color: red; }");

    const started = await startServer(rootDir, distDir, { openServer: (value) => { server = value; } });

    expect(await (await fetch(`http://localhost:${started}/`)).text()).toBe("<main>MDB</main>");
    expect(await (await fetch(`http://localhost:${started}/docs/readme`)).text()).toBe("<main>MDB</main>");
    expect(await (await fetch(`http://localhost:${started}/main.js`)).text()).toBe("console.log('mdb')");
    expect(await (await fetch(`http://localhost:${started}/styles/global.css`)).text()).toBe("body { color: red; }");
  });
});
