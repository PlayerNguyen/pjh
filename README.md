# pjh

**pjh → Pi Job Headless** is a web application with a dashboard to manage repetition jobs, designed to be modularizable.

Define tasks in code, plug them into the core process, and control them from a dashboard. The core schedules cron jobs, runs each execution as a `TaskInstance`, and serves a REST API consumed by the SvelteKit dashboard.

## Architecture

```
Task packages (code)  ──register──▶  apps/core  (Bun process)
                                       ├─ scheduler   (Bun.cron)
                                       ├─ executor    (TaskInstance lifecycle)
                                       ├─ Kysely + bun:sqlite
                                       └─ Hono REST API  ◀── apps/dashboard (SvelteKit + shadcn-svelte)
```

## Structure

This is a Bun workspace monorepo:

```
apps/core        # core server: task engine, scheduler, REST API
apps/dashboard   # SvelteKit dashboard (Svelte 5 + Tailwind v4 + shadcn-svelte)
packages/task    # task SDK: defineTask, TaskContext, TaskRegistry, DB types
```

Sub-packages are importable via path aliases:

- `@pjh/*` → `packages/*/src`
- `@pjh/app/*` → `apps/*/src`

## Getting started

```bash
bun install
```

Start the core and the dashboard together:

```bash
bun run dev
```

Or individually:

```bash
bun run dev:core        # http://127.0.0.1:8787
bun run dev:dashboard   # http://localhost:5173, proxies /api to the core
```

Copy `.env.example` to `.env` to configure the database path, ports and timezone.

## Defining a task

Tasks live in code and are plugged into the core. Create a module that default-exports a `TaskDefinition`:

```ts
import { defineTask } from "@pjh/task";

export default defineTask({
  id: "heartbeat",
  name: "Heartbeat",
  description: "Runs every minute.",
  schedule: "* * * * *",     // cron expression or nickname, e.g. "@hourly"
  timeoutMs: 10_000,
  concurrency: "skip",       // "skip" | "queue" | "parallel"
  async handle(ctx) {
    ctx.log("info", "tick", { at: new Date().toISOString() });
    return { ok: true };
  },
});
```

Built-in tasks under `apps/core/src/tasks/**/*.task.ts` are loaded automatically. Extra modules (local paths or installed packages) are listed in `apps/core/pjh.config.ts`:

```ts
export default {
  tasks: ["./src/tasks/heartbeat.task.ts", "@acme/pjh-tasks/backup"],
  defaultEnabled: true,
};
```

`handle(ctx)` receives a `TaskContext`:

- `ctx.db` — typed Kysely query builder over the shared SQLite database
- `ctx.log(level, message, data?)` — append to the instance log
- `ctx.signal` — `AbortSignal`, aborted on timeout or manual cancel
- `ctx.trigger` — `"schedule" | "manual" | "retry"`
- `ctx.payload` — input passed to a manual run

## Data model

SQLite via native `bun:sqlite`, queried through Kysely.

- `task` — runtime state per code-defined task (enabled, schedule, timezone, timeout, concurrency, next/last run)
- `task_instance` — one row per execution (status, trigger, timings, result, error)
- `task_instance_log` — log lines emitted by an instance

Code is the source of truth for task descriptions; on boot the loader upserts `task` rows and preserves runtime fields edited from the dashboard.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health probe |
| GET | `/api/stats` | Aggregate counts |
| GET | `/api/tasks` | List tasks |
| GET | `/api/tasks/:id` | Task detail |
| PATCH | `/api/tasks/:id` | Update enabled/schedule/timezone/timeout/concurrency |
| POST | `/api/tasks/:id/run` | Trigger a manual run |
| GET | `/api/instances` | List instances (`taskId`, `status`, `limit`, `offset`) |
| GET | `/api/instances/:id` | Instance detail with logs |
| POST | `/api/instances/:id/cancel` | Cancel a running instance |

No authentication — this is the primary architectural flow.

## Scripts

```bash
bun run dev          # core + dashboard
bun run dev:core
bun run dev:dashboard
bun run test         # core tests (bun test)
bun run check        # tsc + svelte-check
bun run typecheck
bun run lint         # Biome
bun run lint:fix
```

## License

MIT © PlayerNguyen
