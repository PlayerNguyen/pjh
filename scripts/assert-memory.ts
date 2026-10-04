#!/usr/bin/env bun
/**
 * Boots a command and asserts its peak resident memory (RSS) stays below a
 * threshold. Intended for CI to guard the production build against bloat.
 *
 * Usage:
 *   bun scripts/assert-memory.ts -- <command...> \
 *     [--url http://127.0.0.1:8787/api/health] \
 *     [--limit-mb 200] \
 *     [--duration-ms 6000] \
 *     [--interval-ms 250] \
 *     [--env KEY=VALUE ...]
 *
 * Options may appear anywhere after the command; a literal `--` separates the
 * command from this script's own flags. Everything after the command that is
 * not a known flag is treated as a command argument.
 */
import { type ChildProcess, spawn } from "node:child_process";

interface Options {
  command: string[];
  url?: string;
  limitMb: number;
  durationMs: number;
  intervalMs: number;
  env: Record<string, string>;
  readyTimeoutMs: number;
}

const KNOWN_FLAGS = new Set([
  "--url",
  "--limit-mb",
  "--duration-ms",
  "--interval-ms",
  "--env",
  "--ready-timeout-ms",
]);

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    command: [],
    limitMb: 200,
    durationMs: 6000,
    intervalMs: 250,
    env: {},
    readyTimeoutMs: 30000,
  };

  const tokens = argv.filter((t) => t !== "--");
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) break;
    if (token.startsWith("--") && KNOWN_FLAGS.has(token)) {
      const value = tokens[i + 1];
      if (value === undefined) {
        throw new Error(`Missing value for ${token}`);
      }
      switch (token) {
        case "--url":
          opts.url = value;
          break;
        case "--limit-mb":
          opts.limitMb = Number(value);
          break;
        case "--duration-ms":
          opts.durationMs = Number(value);
          break;
        case "--interval-ms":
          opts.intervalMs = Number(value);
          break;
        case "--ready-timeout-ms":
          opts.readyTimeoutMs = Number(value);
          break;
        case "--env": {
          const eq = value.indexOf("=");
          if (eq === -1) throw new Error(`--env expects KEY=VALUE, got "${value}"`);
          opts.env[value.slice(0, eq)] = value.slice(eq + 1);
          break;
        }
      }
      i += 2;
      continue;
    }
    opts.command.push(token);
    i += 1;
  }

  if (opts.command.length === 0) {
    throw new Error(
      "No command provided. Usage: bun scripts/assert-memory.ts -- <command...>",
    );
  }

  return opts;
}

/** RSS of a process tree in bytes, using ps (portable across macOS/Linux). */
async function rssBytes(pid: number): Promise<number> {
  const proc = Bun.spawnSync(["ps", "-o", "rss=", "-p", String(pid)]);
  if (proc.exitCode !== 0) return 0;
  const kb = Number.parseInt(proc.stdout.toString().trim(), 10);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

async function waitForReady(
  url: string,
  timeoutMs: number,
  child: ChildProcess,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await Bun.sleep(250);
  }
  return false;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const [cmd, ...args] = opts.command;

  console.log(`[mem] starting: ${opts.command.join(" ")}`);
  const child: ChildProcess = spawn(cmd as string, args, {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...opts.env },
  });

  if (!child.pid) throw new Error("Failed to spawn command");

  const cleanup = () => {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 3000);
    }
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    if (opts.url) {
      const ready = await waitForReady(opts.url, opts.readyTimeoutMs, child);
      if (!ready) {
        console.error(`[mem] server never became ready at ${opts.url}`);
        cleanup();
        process.exit(1);
      }
      console.log(`[mem] ready at ${opts.url}`);
    }

    let peak = 0;
    const start = Date.now();
    while (Date.now() - start < opts.durationMs) {
      if (child.exitCode !== null) {
        console.error(`[mem] process exited early with code ${child.exitCode}`);
        process.exit(1);
      }
      peak = Math.max(peak, await rssBytes(child.pid));
      await Bun.sleep(opts.intervalMs);
    }

    cleanup();

    const limitBytes = opts.limitMb * 1024 * 1024;
    const ok = peak <= limitBytes;
    const line = `[mem] peak RSS ${mb(peak)} / limit ${opts.limitMb} MB`;
    if (ok) {
      console.log(`✅ ${line}`);
      process.exit(0);
    }
    console.error(`❌ ${line}`);
    process.exit(1);
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(
    `[mem] fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
