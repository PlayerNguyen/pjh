import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const strategies = await createApi(fetch).strategies();
  return { strategies };
};
