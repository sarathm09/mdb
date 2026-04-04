import sveltePlugin from "./plugins/svelte-plugin";

const result = await Bun.build({
  entrypoints: ["./src/client/main.ts"],
  outdir: "./dist",
  plugins: [sveltePlugin],
  minify: true,
  sourcemap: "linked",
  target: "browser",
});

if (!result.success) {
  console.error("Build failed:");
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

await Bun.$`cp -r src/client/styles dist/styles`;

console.log(`Build complete: ${result.outputs.length} files written to dist/`);
