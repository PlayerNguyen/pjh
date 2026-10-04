import { resolve } from "node:path";

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dbPath(value: string | undefined): string {
  if (!value) return resolve(import.meta.dir, "../../../data/pjh.sqlite");
  if (value === ":memory:" || value.startsWith("file:")) return value;
  return resolve(value);
}

export const config = {
  databaseUrl: dbPath(process.env.PJH_DB_PATH),
  host: process.env.PJH_HOST ?? "127.0.0.1",
  port: num(process.env.PJH_PORT, 8787),
  timezone: process.env.PJH_TZ,
} as const;
