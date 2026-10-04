import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
  const api = createApi(fetch);
  const task = await api.task(params.id);
  const [strategy, instances] = await Promise.all([
    api.strategy(task.type),
    api.instances({ delegationId: params.id, limit: 20 }),
  ]);
  return { task, strategy, instances };
};
