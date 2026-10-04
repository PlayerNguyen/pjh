import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
  const api = createApi(fetch);
  const [task, instances] = await Promise.all([
    api.task(params.id),
    api.instances({ taskId: params.id, limit: 20 }),
  ]);
  return { task, instances };
};
