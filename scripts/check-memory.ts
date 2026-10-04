#!/usr/bin/env bun
/**
 * Builds and boots the production stack (core + dashboard), then asserts the
 * peak resident memory of each process stays under a threshold.
 *
 * Usage: bun scripts/check-memory.ts [--limit-mb 200] [--duration-ms 6000]
 */
import { type ChildProcess, spawn } from "node:child_process";

interface Args {
  limitMb: number;
  durationMs: number;
  intervalMs: number;
}

function parse(argv: string[]): Args {
  const args: Args = { limitMb: 200, durationMs: 6000, intervalMs: 250 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const v = argv[i + 1];
    if (t === "--limit-mb") args.limitMb = Number(v);
    if (t === "--duration-ms") args.durationMs = Number(v);
    if (t === "--interval-ms") args.intervalMs = Number(v);
  }
  return args;
}

async function rssBytes(pid: number): Promise<number> {
  const proc = Bun.spawnSync(["ps", "-o", "rss=", "-p", String(pid)]);
  if (proc.exitCode !== 0) return 0;
  const kb = Number.parseInt(proc.stdout.toString().trim(), 10);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

async function waitFor(
  url: string,
  timeoutMs: number,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`process exited early: ${child.exitCode}`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // retry
    }
    await Bun.sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Target {
  name: string;
  cmd: string[];
  env: Record<string, string>;
  url: string;
}

async function measure(
  target: Target,
  opts: Args,
): Promise<{ name: string; peak: number; ok: boolean }> {
  console.log(`\n[mem] starting ${target.name}: ${target.cmd.join(" ")}`);
  const child = spawn(target.cmd[0] as string, target.cmd.slice(1), {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...target.env },
  });
  if (!child.pid) throw new Error(`failed to spawn ${target.name}`);

  try {
    await waitFor(target.url, 30000, child);
    console.log(`[mem] ${target.name} ready at ${target.url}`);

    let peak = 0;
    const start = Date.now();
    while (Date.now() - start < opts.durationMs) {
      if (child.exitCode !== null) {
        throw new Error(`${target.name} exited early: ${child.exitCode}`);
      }
      peak = Math.max(peak, await rssBytes(child.pid));
      await Bun.sleep(opts.intervalMs);
    }

    const ok = peak <= opts.limitMb * 1024 * 1024;
    console.log(
      `${ok ? "✅" : "❌"} [mem] ${target.name} peak RSS ${mb(peak)} / limit ${opts.limitMb} MB`,
    );
    return { name: target.name, peak, ok };
  } finally {
    child.kill("SIGTERM");
    await Bun.sleep(300);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

async function main(): Promise<void> {
  const opts = parse(process.argv.slice(2));

  // --- build production artifacts ---
  console.log("[mem] building dashboard production bundle...");
  const build = Bun.spawnSync(["bun", "run", "--cwd", "apps/dashboard", "build"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (build.exitCode !== 0) {
    console.error("[mem] dashboard build failed");
    process.exit(1);
  }

  const corePort = 8931;
  const dashPort = 5391;

  const core = await measure(
    {
      name: "core",
      cmd: ["bun", "run", "--cwd", "apps/core", "src/index.ts"],
      env: { PJH_DB_PATH: ":memory:", PJH_PORT: String(corePort) },
      url: `http://127.0.0.1:${corePort}/api/health`,
    },
    opts,
  );

  // Boot a long-lived core for the dashboard to proxy to while it is measured.
  const coreForDash = spawn("bun", ["run", "--cwd", "apps/core", "src/index.ts"], {
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, PJH_DB_PATH: ":memory:", PJH_PORT: String(corePort) },
  });
  await waitFor(`http://127.0.0.1:${corePort}/api/health`, 30000, coreForDash);

  let dashboard: { name: string; peak: number; ok: boolean };
  try {
    dashboard = await measure(
      {
        name: "dashboard",
        cmd: ["node", "apps/dashboard/build/index.js"],
        env: { PORT: String(dashPort), CORE_URL: `http://127.0.0.1:${corePort}` },
        url: `http://127.0.0.1:${dashPort}/`,
      },
      opts,
    );
  } finally {
    coreForDash.kill("SIGTERM");
    await Bun.sleep(300);
    if (coreForDash.exitCode === null) coreForDash.kill("SIGKILL");
  }

  const allOk = core.ok && dashboard.ok;
  if (!allOk) {
    console.error("\n[mem] memory assertion failed");
    process.exit(1);
  }
  console.log(`\n✅ [mem] all processes under ${opts.limitMb} MB`);
}

main().catch((error) => {
  console.error(
    `[mem] fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
