import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
  const instance = await createApi(fetch).instance(params.id);
  return { instance };
};
