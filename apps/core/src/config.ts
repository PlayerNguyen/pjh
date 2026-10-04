import { resolve } from "node:path";

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  databaseUrl: process.env.PJH_DB_PATH
    ? resolve(process.env.PJH_DB_PATH)
    : resolve(import.meta.dir, "../../../data/pjh.sqlite"),
  host: process.env.PJH_HOST ?? "127.0.0.1",
  port: num(process.env.PJH_PORT, 8787),
  timezone: process.env.PJH_TZ,
} as const;
