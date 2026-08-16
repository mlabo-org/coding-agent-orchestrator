#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createInstallPlan, findInstalledPlugin, listPresentPluginFiles, personalMarketplacePath, readJsonIfPresent, writeJsonAtomic } from "./lib/plugin-installer.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = parseMode(process.argv.slice(2));

try {
  if (mode === "help") {
    print({ usage: ["npm run plugin:install:check", "npm run plugin:install"], note: "The check is read-only. Installation registers the complete source bundle, including all four Hooks, through the official Codex CLI." });
    process.exit(0);
  }
  const homeDir = os.homedir();
  const marketplacePath = personalMarketplacePath(homeDir);
  const [manifest, hooksDocument, presentFiles, marketplaceDocument, configuredMarketplaces] = await Promise.all([
    readJson(path.join(repoRoot, ".codex-plugin", "plugin.json")),
    readJson(path.join(repoRoot, "hooks", "hooks.json")),
    listPresentPluginFiles(repoRoot),
    readJsonIfPresent(marketplacePath),
    runCodexJson(["plugin", "marketplace", "list", "--json"])
  ]);
  const plan = createInstallPlan({ repoRoot, homeDir, manifest, hooksDocument, presentFiles, marketplaceDocument, configuredMarketplaces });
  if (plan.status !== "ready") { print(plan, process.stderr); process.exitCode = 1; }
  else if (mode === "check") print({ ...publicPlan(plan), mode: "check", mutated: false });
  else {
    if (plan.marketplaceWrite) await writeJsonAtomic(plan.marketplacePath, plan.marketplaceDocument);
    const installResult = await runCodexJson(["plugin", "add", plan.installSelector, "--json"]);
    const installed = findInstalledPlugin(await runCodexJson(["plugin", "list", "--json"]));
    if (!installed || installed.version !== plan.plugin.version) throw new Error(`Codex did not report ${plan.plugin.name}@${plan.plugin.version} after installation.`);
    print({ ...publicPlan(plan), mode: "install", mutated: true, installResult, installed: { name: installed.name, version: installed.version, enabled: installed.enabled ?? null }, nextStep: "Restart Codex, review/trust the bundled Hooks if prompted, and verify CAO from a fresh task." });
  }
} catch (error) {
  print({ status: "error", code: error.code || "INSTALL_FAILED", message: error.message }, process.stderr);
  process.exitCode = 1;
}

function parseMode(args) {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0]))) return "help";
  if (args.length === 1 && args[0] === "--check") return "check";
  if (args.length === 1 && args[0] === "--install") return "install";
  throw new Error("Use exactly one of --check or --install.");
}
async function readJson(filePath) { return JSON.parse(await fs.readFile(filePath, "utf8")); }
async function runCodexJson(args) {
  let stdout;
  try { ({ stdout } = await execFileAsync("codex", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })); }
  catch (error) { const failed = new Error(error.code === "ENOENT" ? "The codex CLI is not available on PATH." : String(error.stderr || error.message).trim()); failed.code = error.code === "ENOENT" ? "CODEX_CLI_MISSING" : "CODEX_CLI_FAILED"; throw failed; }
  try { return JSON.parse(stdout); } catch { const invalid = new Error(`Codex CLI returned non-JSON output for: codex ${args.join(" ")}`); invalid.code = "CODEX_CLI_INVALID_JSON"; throw invalid; }
}
function publicPlan(plan) { const { marketplaceDocument: _privateDocument, ...safePlan } = plan; return safePlan; }
function print(value, stream = process.stdout) { stream.write(`${JSON.stringify(value, null, 2)}\n`); }
