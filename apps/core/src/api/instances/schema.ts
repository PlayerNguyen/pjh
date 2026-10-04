import { z } from "zod";

/**
 * Query schema for listing instances (`GET /api/instances`). Numeric strings
 * are coerced, with pagination defaults applied.
 *
 * @example
 * ```ts
 * listInstancesSchema.parse({ limit: "10" });
 * // => { limit: 10, offset: 0 }
 * ```
 */
export const listInstancesSchema = z.object({
  delegationId: z.string().optional(),
  status: z.enum(["running", "succeeded", "failed", "timeout", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
