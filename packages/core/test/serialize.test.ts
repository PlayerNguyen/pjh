import { describe, expect, test } from "bun:test";
import {
  delegationToDto,
  instanceToDto,
  safeParse,
  strategyToDto,
} from "../src/serialize.ts";

describe("serialize", () => {
  test("should return parsed JSON for valid input", () => {
    expect(safeParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  test("should fall back on invalid JSON", () => {
    expect(safeParse("not json", { fallback: true })).toEqual({ fallback: true });
  });

  test("should fall back on an empty string", () => {
    expect(safeParse("", null)).toBeNull();
  });

  test("should decode params_schema and camelCase fields", () => {
    const dto = strategyToDto({
      type: "heartbeat",
      name: "Heartbeat",
      description: "beats",
      params_schema: '{"type":"object"}',
      default_schedule: "@daily",
      default_timezone: "UTC",
      default_timeout_ms: 1000,
      default_concurrency: "skip",
    });
    expect(dto).toEqual({
      type: "heartbeat",
      name: "Heartbeat",
      description: "beats",
      paramsSchema: { type: "object" },
      defaultSchedule: "@daily",
      defaultTimezone: "UTC",
      defaultTimeoutMs: 1000,
      defaultConcurrency: "skip",
    });
  });

  test("should fall back to {} for a malformed params_schema", () => {
    const dto = strategyToDto({
      type: "x",
      name: "X",
      description: null,
      params_schema: "oops",
      default_schedule: null,
      default_timezone: null,
      default_timeout_ms: null,
      default_concurrency: null,
    });
    expect(dto.paramsSchema).toEqual({});
  });

  test("should decode args and the enabled flag", () => {
    const dto = delegationToDto({
      id: "seed-heartbeat",
      type: "heartbeat",
      name: "Heartbeat",
      args: '{"message":"tick"}',
      schedule: "* * * * *",
      timezone: null,
      enabled: 1,
      timeout_ms: null,
      concurrency: "skip",
      last_run_at: null,
      next_run_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(dto.enabled).toBe(true);
    expect(dto.args).toEqual({ message: "tick" });
    expect(dto.id).toBe("seed-heartbeat");
  });

  test("should map enabled=0 to false", () => {
    const dto = delegationToDto({
      id: "x",
      type: "t",
      name: "n",
      args: "{}",
      schedule: "@daily",
      timezone: null,
      enabled: 0,
      timeout_ms: null,
      concurrency: "skip",
      last_run_at: null,
      next_run_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(dto.enabled).toBe(false);
  });

  test("should camelCase row columns", () => {
    const dto = instanceToDto({
      id: "inst-1",
      delegation_id: "seed-heartbeat",
      status: "succeeded",
      trigger: "manual",
      queued_at: "2026-01-01T00:00:00.000Z",
      started_at: "2026-01-01T00:00:00.000Z",
      finished_at: "2026-01-01T00:00:00.010Z",
      duration_ms: 10,
      result: '{"ok":true}',
      error: null,
    });
    expect(dto.delegationId).toBe("seed-heartbeat");
    expect(dto.durationMs).toBe(10);
    expect(dto.finishedAt).toBe("2026-01-01T00:00:00.010Z");
  });
});
