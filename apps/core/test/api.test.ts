import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { defineTask, TaskRegistry } from "@pjh/task";
import type { Kysely } from "kysely";
import { createApi } from "../src/api/routes.ts";
import { Executor } from "../src/engine/executor.ts";
import { syncTasks } from "../src/engine/loader.ts";
import { Scheduler } from "../src/engine/scheduler.ts";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

async function setup() {
  db = await freshDb();
  const def = defineTask({
    id: "job",
    name: "Job",
    description: "test job",
    schedule: "@hourly",
    handle: () => ({ ok: true }),
  });
  const registry = new TaskRegistry().register(def);
  await syncTasks(db, registry.list());

  const executor = new Executor({ db, getTask: (id) => registry.get(id) });
  const scheduler = new Scheduler(db, async () => {});
  const app = createApi({ db, executor, scheduler });
  return app;
}

describe("api", () => {
  test("GET /api/health", async () => {
    const app = await setup();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });

  test("GET /api/tasks returns synced task", async () => {
    const app = await setup();
    const res = await app.request("/api/tasks");
    const body = (await res.json()) as Array<{ id: string; enabled: boolean }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.id).toBe("job");
    expect(body[0]!.enabled).toBe(true);
  });

  test("PATCH rejects invalid cron", async () => {
    const app = await setup();
    const res = await app.request("/api/tasks/job", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schedule: "not a cron" }),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH disables a task", async () => {
    const app = await setup();
    const res = await app.request("/api/tasks/job", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    const body = (await res.json()) as { enabled: boolean };
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
  });

  test("POST run creates an instance", async () => {
    const app = await setup();
    const res = await app.request("/api/tasks/job/run", { method: "POST" });
    expect(res.status).toBe(202);
    const { instanceId } = (await res.json()) as { instanceId: string };
    await Bun.sleep(30);

    const detail = await app.request(`/api/instances/${instanceId}`);
    const body = (await detail.json()) as { status: string; logs: unknown[] };
    expect(body.status).toBe("succeeded");
    expect(Array.isArray(body.logs)).toBe(true);
  });

  test("GET /api/stats summarizes", async () => {
    const app = await setup();
    const res = await app.request("/api/stats");
    const body = (await res.json()) as { total: number; enabled: number };
    expect(body.total).toBe(1);
    expect(body.enabled).toBe(1);
  });
});
