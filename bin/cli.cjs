#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CLI_PATH = path.resolve(__dirname, "..", "src", "cli.ts");
const HOME = process.env.HOME || process.env.USERPROFILE;
const BUN_BIN_DIR = path.join(HOME, ".bun", "bin");
const BUN_PATH = process.platform === "win32"
  ? path.join(BUN_BIN_DIR, "bun.exe")
  : path.join(BUN_BIN_DIR, "bun");

function findBun() {
  // 1. Try bun on PATH
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return "bun";
  } catch {}

  // 2. Try well-known install location (~/.bun/bin/bun)
  if (fs.existsSync(BUN_PATH)) {
    try {
      execFileSync(BUN_PATH, ["--version"], { stdio: "ignore" });
      return BUN_PATH;
    } catch {}
  }

  return null;
}

function installBun() {
  console.log("Bun runtime not found. Installing bun...");
  try {
    if (process.platform === "win32") {
      execFileSync("powershell", ["-c", "irm bun.sh/install.ps1 | iex"], { stdio: "inherit" });
    } else {
      execFileSync("bash", ["-c", "curl -fsSL https://bun.sh/install | bash"], { stdio: "inherit" });
    }
  } catch {
    console.error("Failed to install bun automatically.");
    console.error("Please install bun manually: https://bun.sh");
    process.exit(1);
  }
}

let bun = findBun();
if (!bun) {
  installBun();
  bun = findBun();
  if (!bun) {
    console.error("Bun installation succeeded but could not locate the binary.");
    console.error("Please restart your terminal or add ~/.bun/bin to your PATH, then try again.");
    process.exit(1);
  }
  console.log("Bun installed successfully.\n");
}

const args = ["run", CLI_PATH, ...process.argv.slice(2)];
try {
  execFileSync(bun, args, { stdio: "inherit" });
} catch (err) {
  process.exit(err.status ?? 1);
}
