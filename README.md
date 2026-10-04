# pjh

**pjh → Pi Job Headless** is a web application with a dashboard to manage repetition jobs, designed to be modularizable.

Define task **strategies** in code, then create **delegations** — named, scheduled instances of a strategy — from a seed migration or the dashboard. The core schedules cron jobs, runs each execution as a `TaskInstance`, and serves a REST API consumed by the SvelteKit dashboard.

## Concepts

- **Task strategy** (code) — reusable logic plus a **zod parameter schema**. Registered from code and mirrored into `task_strategy`. Never created by the web user.
- **Task delegation** (database) — a configured, schedulable instance: `{ type, name, args, schedule, ... }`. Created by a seed migration or by the user in the dashboard. Each delegation spawns `TaskInstance`s.
- **Deduplication** — a delegation is unique by `type` + canonicalized `args`. Creating the same type+args again (even with a different name) is rejected with `409`.
- **UI rendering** — the strategy's zod schema is converted to JSON Schema (`z.toJSONSchema`) and sent to the dashboard, which renders an arguments form.

## Architecture

```
Task strategies (code)  ──register──▶  apps/core  (Bun process)
                                         ├─ scheduler   (Bun.cron, per delegation)
                                         ├─ executor    (TaskInstance lifecycle)
                                         ├─ Kysely + bun:sqlite
                                         └─ Hono REST API  ◀── apps/dashboard (SvelteKit + shadcn-svelte)
```

## Structure

This is a Bun workspace monorepo:

```
apps/core        # core server: strategy registry, delegation service, REST API
apps/dashboard   # SvelteKit dashboard (Svelte 5 + Tailwind v4 + shadcn-svelte)
packages/task    # task SDK: defineTask, TaskContext, TaskRegistry, args helpers, DB types
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

## Defining a task strategy

Strategies live in code and are plugged into the core. Create a module that default-exports a strategy with a zod `args` schema:

```ts
import { defineTask } from "@pjh/task";
import { z } from "zod";

export default defineTask({
  type: "backup",            // stable, unique type id
  name: "Backup",
  description: "Backs up a target to a destination.",
  args: z.object({
    target: z.string().describe("Path to back up"),
    destination: z.string().describe("Where to write the archive"),
    compress: z.boolean().default(true),
  }),
  defaultSchedule: "0 2 * * *",   // proposed when creating a delegation
  defaultConcurrency: "skip",
  async handle(ctx) {
    // ctx.args is fully typed: { target: string; destination: string; compress: boolean }
    ctx.log("info", `backing up ${ctx.args.target}`);
    return { ok: true };
  },
});
```

Built-in strategies under `apps/core/src/tasks/**/*.task.ts` are loaded automatically. Extra modules (local paths or installed packages) are listed in `apps/core/pjh.config.ts`, which also seeds default delegations:

```ts
export default {
  tasks: ["./src/tasks/heartbeat.task.ts", "@acme/pjh-tasks/backup"],
  delegations: [
    { id: "seed-heartbeat", type: "heartbeat", name: "Heartbeat", schedule: "* * * * *" },
  ],
};
```

`handle(ctx)` receives a `TaskContext`:

- `ctx.args` — validated, typed delegation arguments
- `ctx.taskName` / `ctx.type` / `ctx.delegationId` — identity of the running delegation
- `ctx.db` — typed Kysely query builder over the shared SQLite database
- `ctx.log(level, message, data?)` — append to the instance log
- `ctx.signal` — `AbortSignal`, aborted on timeout or manual cancel
- `ctx.trigger` — `"schedule" | "manual" | "retry"`
- `ctx.payload` — input passed to a manual run

## Creating a delegation

Delegations are created either by a seed migration (idempotent, only inserted when absent — user edits are preserved) or by the user in the dashboard. Args are validated against the strategy's schema on create, update and every run. The dashboard renders the form automatically from the schema.

## Data model

SQLite via native `bun:sqlite`, queried through Kysely.

- `task_strategy` — code-defined types + JSON Schema of their params
- `task_delegation` — configured instances (args, schedule, enabled, …), unique by `type` + `args_hash`
- `task_instance` — one row per execution (status, trigger, timings, result, error)
- `task_instance_log` — log lines emitted by an instance

Code is the source of truth for strategies; delegations belong to the database and are managed by the user or seed migrations.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health probe |
| GET | `/api/stats` | Aggregate counts |
| GET | `/api/strategies` | List code-defined task types (with JSON Schema) |
| GET | `/api/strategies/:type` | Strategy detail |
| GET | `/api/tasks` | List delegations |
| GET | `/api/tasks/:id` | Delegation detail |
| POST | `/api/tasks` | Create a delegation (validates args, rejects duplicates) |
| PATCH | `/api/tasks/:id` | Update name/args/schedule/enabled/timeout/concurrency |
| DELETE | `/api/tasks/:id` | Delete a delegation |
| POST | `/api/tasks/:id/run` | Trigger a manual run |
| GET | `/api/instances` | List instances (`delegationId`, `status`, `limit`, `offset`) |
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
