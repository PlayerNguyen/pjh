import { resolve } from "node:path";

/**
 * Parse a numeric environment value, returning `fallback` when unset, empty or
 * non-finite.
 *
 * @param value - Raw environment string.
 * @param fallback - Value used when parsing fails.
 * @returns The parsed number, or `fallback`.
 *
 * @example
 * ```ts
 * num("8787", 3000); // => 8787
 * num(undefined, 3000); // => 3000
 * num("oops", 3000); // => 3000
 * ```
 */
function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolve a database path from the environment. Supports the `:memory:` and
 * `file:` sentinels; every other value is resolved relative to `process.cwd()`.
 *
 * @param value - Raw `PJH_DB_PATH` value.
 * @returns An absolute SQLite path, or a sentinel.
 *
 * @example
 * ```ts
 * dbPath(undefined); // => "/abs/path/data/pjh.sqlite"
 * dbPath(":memory:"); // => ":memory:"
 * ```
 */
function dbPath(value: string | undefined): string {
  if (!value) return resolve(import.meta.dir, "../../../data/pjh.sqlite");
  if (value === ":memory:" || value.startsWith("file:")) return value;
  return resolve(value);
}

/**
 * Resolved runtime configuration for the core server, read from environment
 * variables with sensible defaults.
 *
 * @example
 * ```ts
 * config.port; // => 8787
 * ```
 */
export const config = {
  databaseUrl: dbPath(process.env.PJH_DB_PATH),
  host: process.env.PJH_HOST ?? "127.0.0.1",
  port: num(process.env.PJH_PORT, 8787),
  timezone: process.env.PJH_TZ,
} as const;
