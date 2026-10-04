#!/usr/bin/env bun
/**
 * Runs a package's test suite with coverage and fails when the aggregate line
 * coverage drops below a threshold. Bun does not ship a coverage gate, so we
 * generate an lcov report and enforce the budget here.
 *
 * Usage:
 *   bun scripts/check-coverage.ts --cwd packages/task --min 60
 *
 * Options:
 *   --cwd <dir>   Working directory holding the tests (default: repo root).
 *   --min <n>     Minimum line coverage percentage (default: 60).
 *   --quiet       Only print the final summary.
 */

interface Options {
  cwd: string;
  min: number;
  quiet: boolean;
}

/** Parse the subset of lcov we need: LF/LH (lines) and FNF/FNH (functions). */
interface Totals {
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { cwd: process.cwd(), min: 60, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const value = argv[i + 1];
    switch (token) {
      case "--cwd":
        if (!value) throw new Error("--cwd requires a value");
        opts.cwd = value;
        i++;
        break;
      case "--min":
        if (!value) throw new Error("--min requires a value");
        opts.min = Number(value);
        i++;
        break;
      case "--quiet":
        opts.quiet = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }
  if (!Number.isFinite(opts.min) || opts.min < 0 || opts.min > 100) {
    throw new Error(`--min must be between 0 and 100, got "${opts.min}"`);
  }
  return opts;
}

/**
 * Sum LF/LH and FNF/FNH records from an lcov report.
 *
 * @param lcov - Raw `lcov.info` text.
 * @returns Aggregate found/hit counts for lines and functions.
 *
 * @example
 * ```ts
 * parseLcov("LF:10\nLH:8\nFNF:2\nFNH:1\n");
 * // => { linesFound: 10, linesHit: 8, functionsFound: 2, functionsHit: 1 }
 * ```
 */
export function parseLcov(lcov: string): Totals {
  const totals: Totals = {
    linesFound: 0,
    linesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
  };
  for (const line of lcov.split("\n")) {
    const [key, raw] = line.split(":");
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    switch (key) {
      case "LF":
        totals.linesFound += n;
        break;
      case "LH":
        totals.linesHit += n;
        break;
      case "FNF":
        totals.functionsFound += n;
        break;
      case "FNH":
        totals.functionsHit += n;
        break;
    }
  }
  return totals;
}

/**
 * Percentage of covered items, or 100 when there is nothing to cover.
 *
 * @param hit - Covered count.
 * @param found - Total count.
 * @returns A rounded percentage (0-100).
 *
 * @example
 * ```ts
 * percent(8, 10); // => 80
 * percent(0, 0);  // => 100
 * ```
 */
export function percent(hit: number, found: number): number {
  if (found === 0) return 100;
  return (hit / found) * 100;
}

/** Format a ratio as "hit/found (pct%)". */
function ratio(hit: number, found: number): string {
  return `${hit}/${found} (${percent(hit, found).toFixed(2)}%)`;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const coverageDir = `${opts.cwd.replace(/\/$/, "")}/coverage`;

  const proc = Bun.spawnSync(
    [
      "bun",
      "test",
      "--coverage",
      "--coverage-reporter=lcov",
      `--coverage-dir=${coverageDir}`,
    ],
    {
      cwd: opts.cwd,
      stdio: opts.quiet
        ? ["ignore", "pipe", "pipe"]
        : ["inherit", "inherit", "inherit"],
    },
  );

  if (proc.exitCode !== 0) {
    console.error(`\n[coverage] tests failed in ${opts.cwd}`);
    if (opts.quiet) {
      console.error(proc.stdout?.toString() ?? "");
      console.error(proc.stderr?.toString() ?? "");
    }
    process.exit(proc.exitCode ?? 1);
  }

  const lcovFile = Bun.file(`${coverageDir}/lcov.info`);
  if (!(await lcovFile.exists())) {
    console.error(`[coverage] no lcov report at ${coverageDir}/lcov.info`);
    process.exit(1);
  }

  const totals = parseLcov(await lcovFile.text());
  const linePct = percent(totals.linesHit, totals.linesFound);

  const label = opts.cwd === process.cwd() ? "." : opts.cwd;
  console.log(`\n[coverage] ${label}`);
  console.log(`  lines:     ${ratio(totals.linesHit, totals.linesFound)}`);
  console.log(`  functions: ${ratio(totals.functionsHit, totals.functionsFound)}`);

  const ok = linePct >= opts.min;
  console.log(
    `${ok ? "✅" : "❌"} line coverage ${linePct.toFixed(2)}% / min ${opts.min}%`,
  );
  if (!ok) {
    console.error(`[coverage] ${label} is below the ${opts.min}% threshold`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(
      `[coverage] fatal: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
