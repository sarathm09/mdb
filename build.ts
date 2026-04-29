import { build as esbuild } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

console.log("Building client with Vite...");
execFileSync("npx", ["vite", "build"], { stdio: "inherit" });

console.log("Building CLI with esbuild...");
const serverResult = await esbuild({
  entryPoints: ["./src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "./dist/cli.mjs",
  banner: { js: "#!/usr/bin/env node" },
  external: ["open"],
  define: {
    "process.env.MDB_VERSION": JSON.stringify(pkg.version),
  },
  minify: false,
});

if (serverResult.errors.length > 0) {
  console.error("Server build failed:");
  for (const err of serverResult.errors) {
    console.error(err);
  }
  process.exit(1);
}

console.log("Build complete: dist/client/ + dist/cli.mjs");
