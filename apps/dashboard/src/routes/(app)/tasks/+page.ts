import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const api = createApi(fetch);
  const [tasks, strategies] = await Promise.all([api.tasks(), api.strategies()]);
  return { tasks, strategies };
};
