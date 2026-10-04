import { defineTask } from "@pjh/task";

export default defineTask({
  id: "heartbeat",
  name: "Heartbeat",
  description: "Logs a heartbeat line every minute to verify the scheduler.",
  schedule: "* * * * *",
  timeoutMs: 10_000,
  concurrency: "skip",
  async handle(ctx) {
    ctx.log("info", "heartbeat tick", { at: new Date().toISOString() });
    return { ok: true };
  },
});
