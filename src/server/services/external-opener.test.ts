import { describe, expect, test } from "bun:test";
import { openExternalPath } from "./external-opener";

describe("openExternalPath", () => {
  test("refuses to launch OS applications during tests", async () => {
    await expect(openExternalPath({ path: "/tmp/example.md", action: "editor" })).rejects.toThrow(
      "External applications cannot be opened during tests",
    );
  });
});
