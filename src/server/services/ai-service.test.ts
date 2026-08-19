import { describe, expect, test } from "bun:test";
import { buildAIInvocation, parseAIResponse } from "./ai-service";

describe("buildAIInvocation", () => {
  test("builds Claude Code invocation with model and agent", () => {
    expect(buildAIInvocation({ harness: "claude", model: "opus", agent: "reviewer" }, "prompt", "/repo")).toEqual({
      command: "claude",
      args: ["--print", "--output-format", "text", "--model", "opus", "--agent", "reviewer", "prompt"],
    });
  });

  test("builds Codex and OpenCode invocations", () => {
    expect(buildAIInvocation({ harness: "codex", model: "gpt-5", agent: "strict" }, "prompt", "/repo")).toEqual({
      command: "codex",
      args: ["exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "--cd", "/repo", "--model", "gpt-5", "--profile", "strict", "prompt"],
    });
    expect(buildAIInvocation({ harness: "opencode", model: "openai/gpt-5", agent: "reviewer", executablePath: "/bin/opencode" }, "prompt", "/repo")).toEqual({
      command: "/bin/opencode",
      args: ["run", "--format", "default", "--dir", "/repo", "--model", "openai/gpt-5", "--agent", "reviewer", "prompt"],
    });
  });
});

describe("parseAIResponse", () => {
  test("accepts fenced and plain JSON", () => {
    const response = { fileContent: null, commentReplies: [{ parentId: "1", body: "Fixed" }] };
    expect(parseAIResponse(`\`\`\`json\n${JSON.stringify(response)}\n\`\`\``)).toEqual(response);
    expect(parseAIResponse(JSON.stringify(response))).toEqual(response);
  });
});
