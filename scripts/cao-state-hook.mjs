#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../bin/coding-agents.mjs", import.meta.url));
const child = spawn(process.execPath, [cliPath, "hook-event"], {
  stdio: ["inherit", "inherit", "inherit"],
});

child.on("error", (error) => {
  process.stderr.write(`CAO hook failed to start: ${error.message}\n`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`CAO hook terminated by ${signal}\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
