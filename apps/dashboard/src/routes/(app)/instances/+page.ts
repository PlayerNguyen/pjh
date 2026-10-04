import { createApi } from "$lib/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url, fetch }) => {
  const statusParam = url.searchParams.get("status") ?? undefined;
  const instances = await createApi(fetch).instances({
    status: (statusParam as never) || undefined,
    limit: 100,
  });
  return { instances, status: statusParam ?? "" };
};
