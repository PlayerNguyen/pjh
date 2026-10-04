import type { TaskInstanceStatus } from "@pjh/task";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString();
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const units: [number, string][] = [
    [1000, "s"],
    [60_000, "m"],
    [3_600_000, "h"],
    [86_400_000, "d"],
  ];
  let label = `${Math.round(abs / 1000)}s`;
  for (const [ms, unit] of units) {
    if (abs >= ms) label = `${Math.round(abs / ms)}${unit}`;
  }
  return `${label} ${suffix}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(2)}m`;
}

export const statusVariant: Record<
  TaskInstanceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  running: "default",
  succeeded: "secondary",
  failed: "destructive",
  timeout: "outline",
  cancelled: "outline",
};
