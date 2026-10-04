import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const api = createApi(fetch);
  const [stats, tasks, instances] = await Promise.all([
    api.stats(),
    api.tasks(),
    api.instances({ limit: 8 }),
  ]);

  const upcoming = tasks
    .filter((t) => t.enabled && t.nextRunAt)
    .sort(
      (a, b) =>
        new Date(a.nextRunAt as string).getTime() -
        new Date(b.nextRunAt as string).getTime(),
    )
    .slice(0, 5);

  return { stats, tasks, instances, upcoming };
};
