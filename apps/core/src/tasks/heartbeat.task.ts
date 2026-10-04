import { defineTask } from "@pjh/task";
import { z } from "zod";

export default defineTask({
  type: "heartbeat",
  name: "Heartbeat",
  description: "Logs a heartbeat line on a schedule to verify the scheduler.",
  args: z.object({
    message: z.string().default("heartbeat tick").describe("Log message"),
  }),
  defaultSchedule: "* * * * *",
  defaultTimeoutMs: 10_000,
  defaultConcurrency: "skip",
  async handle(ctx) {
    ctx.log("info", ctx.args.message, { at: new Date().toISOString() });
    return { ok: true };
  },
});
