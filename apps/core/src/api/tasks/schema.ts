import { z } from "zod";

/**
 * Body schema for creating a delegation (`POST /api/tasks`). Unknown keys are
 * rejected so typos surface as 400s.
 *
 * @example
 * ```ts
 * const body = createTaskSchema.parse({
 *   type: "heartbeat",
 *   name: "Heartbeat",
 *   args: { message: "tick" },
 * });
 * // => { type: "heartbeat", name: "Heartbeat", args: { message: "tick" } }
 * ```
 */
export const createTaskSchema = z
  .object({
    type: z.string().min(1),
    name: z.string().min(1),
    args: z.unknown().optional(),
    schedule: z.string().min(1).optional(),
    timezone: z.string().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().nonnegative().nullable().optional(),
    concurrency: z.enum(["skip", "queue", "parallel"]).optional(),
  })
  .strict();

/**
 * Body schema for partially updating a delegation (`PATCH /api/tasks/:id`).
 *
 * @example
 * ```ts
 * const patch = patchTaskSchema.parse({ enabled: false });
 * // => { enabled: false }
 * ```
 */
export const patchTaskSchema = z
  .object({
    name: z.string().min(1).optional(),
    args: z.unknown().optional(),
    schedule: z.string().min(1).optional(),
    timezone: z.string().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().nonnegative().nullable().optional(),
    concurrency: z.enum(["skip", "queue", "parallel"]).optional(),
  })
  .strict();

/**
 * Optional body schema for manually running a delegation
 * (`POST /api/tasks/:id/run`). An empty or absent body is valid.
 *
 * @example
 * ```ts
 * runTaskSchema.parse(undefined);            // => undefined
 * runTaskSchema.parse({ payload: { n: 1 } }); // => { payload: { n: 1 } }
 * ```
 */
export const runTaskSchema = z
  .object({ payload: z.unknown().optional() })
  .strict()
  .optional();
