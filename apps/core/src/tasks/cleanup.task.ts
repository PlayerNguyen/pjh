import { defineTask } from "@pjh/task";
import { z } from "zod";

export default defineTask({
  type: "cleanup-instances",
  name: "Cleanup old instances",
  description: "Deletes finished task instances older than a retention window.",
  args: z.object({
    retentionDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(7)
      .describe("How many days of history to keep"),
  }),
  defaultSchedule: "0 3 * * *",
  defaultTimeoutMs: 30_000,
  defaultConcurrency: "skip",
  async handle(ctx) {
    const cutoff = new Date(
      Date.now() - ctx.args.retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const deleted = await ctx.db
      .deleteFrom("task_instance")
      .where("status", "!=", "running")
      .where("queued_at", "<", cutoff)
      .executeTakeFirst();

    const count = Number(deleted.numDeletedRows ?? 0n);
    ctx.log("info", `removed ${count} old instance(s)`, {
      cutoff,
      retentionDays: ctx.args.retentionDays,
    });
    return { deleted: count };
  },
});
