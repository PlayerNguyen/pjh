import { defineTask } from "@pjh/task";

export default defineTask({
  id: "cleanup-instances",
  name: "Cleanup old instances",
  description: "Deletes finished task instances older than 7 days.",
  schedule: "0 3 * * *",
  timeoutMs: 30_000,
  concurrency: "skip",
  async handle(ctx) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const deleted = await ctx.db
      .deleteFrom("task_instance")
      .where("status", "!=", "running")
      .where("queued_at", "<", cutoff)
      .executeTakeFirst();

    const count = Number(deleted.numDeletedRows ?? 0n);
    ctx.log("info", `removed ${count} old instance(s)`, { cutoff });
    return { deleted: count };
  },
});
