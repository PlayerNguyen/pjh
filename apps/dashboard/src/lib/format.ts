import type { TaskInstanceStatus } from "@pjh/task";
import type { Locale } from "./i18n/locales.ts";

export function formatDate(
  value: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
}

export function formatRelative(
  value: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const abs = Math.abs(diff);
  const isPast = diff >= 0;

  const rtf = new Intl.RelativeTimeFormat(locale === "vi" ? "vi" : "en", {
    numeric: "auto",
  });

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [1000, "second"],
    [60_000, "minute"],
    [3_600_000, "hour"],
    [86_400_000, "day"],
  ];

  let unit: Intl.RelativeTimeFormatUnit = "second";
  let divisor = 1000;
  for (const [ms, u] of units) {
    if (abs >= ms) {
      divisor = ms;
      unit = u;
    }
  }

  const amount = Math.round(abs / divisor);
  return rtf.format(isPast ? -amount : amount, unit);
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
