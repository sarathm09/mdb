import type { BunPlugin } from "bun";

const sveltePlugin: BunPlugin = {
  name: "svelte",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async (args) => {
      const { compile } = await import("svelte/compiler");
      const source = await Bun.file(args.path).text();
      const result = compile(source, {
        filename: args.path,
        generate: "client",
        css: "injected",
        dev: false,
      });
      return {
        contents: result.js.code,
        loader: "js",
      };
    });
  },
};

export default sveltePlugin;
