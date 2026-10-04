import { afterEach, describe, expect, test } from "bun:test";
import {
  DelegationService,
  Executor,
  Scheduler,
  syncStrategies,
} from "@pjh/process-engine";
import type { PjhDB } from "@pjh/task";
import { defineTask, TaskRegistry } from "@pjh/task";
import type { Kysely } from "kysely";
import { z } from "zod";
import { createApi } from "../src/api/routes.ts";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

async function setup() {
  db = await freshDb();
  const def = defineTask({
    type: "job",
    name: "Job",
    description: "test job",
    args: z.object({ target: z.string() }),
    defaultSchedule: "@hourly",
    handle: () => ({ ok: true }),
  });
  const registry = new TaskRegistry().register(def);
  await syncStrategies(db, registry.list());

  const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
  const scheduler = new Scheduler(db, async () => {});
  const delegations = new DelegationService(db, (t) => registry.get(t), scheduler);
  const app = createApi({ db, executor, delegations });
  return app;
}

async function createTask(
  app: ReturnType<typeof createApi>,
  body: Record<string, unknown>,
) {
  return app.request("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api", () => {
  test("should return ok from GET /api/health", async () => {
    const app = await setup();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });

  test("should expose params schema from GET /api/strategies", async () => {
    const app = await setup();
    const res = await app.request("/api/strategies");
    const body = (await res.json()) as Array<{
      type: string;
      paramsSchema: { properties?: Record<string, unknown> };
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.type).toBe("job");
    expect(body[0]!.paramsSchema.properties).toHaveProperty("target");
  });

  test("should validate args when creating a delegation", async () => {
    const app = await setup();
    const bad = await createTask(app, {
      type: "job",
      name: "Bad",
      args: { target: 123 },
    });
    expect(bad.status).toBe(400);
  });

  test("should reject duplicate type+args regardless of name", async () => {
    const app = await setup();
    const first = await createTask(app, {
      type: "job",
      name: "First",
      args: { target: "a" },
    });
    expect(first.status).toBe(201);

    const second = await createTask(app, {
      type: "job",
      name: "Second (different name)",
      args: { target: "a" },
    });
    expect(second.status).toBe(409);
    const err = (await second.json()) as { code: string; existingId: string };
    expect(err.code).toBe("duplicate-args");
    expect(err.existingId).toBeTruthy();
  });

  test("should allow the same type with different args", async () => {
    const app = await setup();
    await createTask(app, { type: "job", name: "A", args: { target: "a" } });
    const other = await createTask(app, {
      type: "job",
      name: "B",
      args: { target: "b" },
    });
    expect(other.status).toBe(201);
  });

  test("should reject an unknown strategy type", async () => {
    const app = await setup();
    const res = await createTask(app, { type: "nope", name: "N" });
    expect(res.status).toBe(400);
  });

  test("should update and re-validate args on PATCH", async () => {
    const app = await setup();
    const created = await createTask(app, {
      type: "job",
      name: "A",
      args: { target: "a" },
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { enabled: boolean }).enabled).toBe(false);
  });

  test("should remove a delegation on DELETE", async () => {
    const app = await setup();
    const created = await createTask(app, {
      type: "job",
      name: "A",
      args: { target: "z" },
    });
    const { id } = (await created.json()) as { id: string };
    const res = await app.request(`/api/tasks/${id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
    const rows = await db.selectFrom("task_delegation").select("id").execute();
    expect(rows).toHaveLength(0);
  });

  test("should create an instance on run and summarize stats", async () => {
    const app = await setup();
    const created = await createTask(app, {
      type: "job",
      name: "R",
      args: { target: "run" },
    });
    const { id } = (await created.json()) as { id: string };

    const run = await app.request(`/api/tasks/${id}/run`, { method: "POST" });
    expect(run.status).toBe(202);
    const { instanceId } = (await run.json()) as { instanceId: string };
    await Bun.sleep(30);

    const detail = await app.request(`/api/instances/${instanceId}`);
    expect(((await detail.json()) as { status: string }).status).toBe("succeeded");

    const statRes = await app.request("/api/stats");
    const body = (await statRes.json()) as { total: number; strategies: number };
    expect(body.total).toBe(1);
    expect(body.strategies).toBe(1);
  });
});
