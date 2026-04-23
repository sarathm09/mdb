import sveltePlugin from "./plugins/svelte-plugin";
import { build as esbuild } from "esbuild";

const result = await Bun.build({
  entrypoints: ["./src/client/main.ts"],
  outdir: "./dist",
  plugins: [sveltePlugin],
  minify: true,
  sourcemap: "linked",
  target: "browser",
});

if (!result.success) {
  console.error("Client build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await Bun.write("./dist/index.html", `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Browser</title>
  <link rel="stylesheet" href="/styles/global.css">
  <link rel="stylesheet" href="/styles/markdown.css">
  <link rel="stylesheet" href="/main.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/main.js"></script>
</body>
</html>`);

await Bun.$`rm -rf dist/styles && cp -r src/client/styles dist/styles`;

console.log(`Client build complete: ${result.outputs.length} files written to dist/`);

const serverResult = await esbuild({
  entryPoints: ["./src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "./dist/cli.mjs",
  banner: { js: "#!/usr/bin/env node" },
  external: ["open"],
  minify: false,
});

if (serverResult.errors.length > 0) {
  console.error("Server build failed:");
  for (const err of serverResult.errors) {
    console.error(err);
  }
  process.exit(1);
}

console.log("Server build complete: dist/cli.mjs");
