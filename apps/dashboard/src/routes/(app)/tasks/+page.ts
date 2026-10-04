import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const tasks = await createApi(fetch).tasks();
  return { tasks };
};
