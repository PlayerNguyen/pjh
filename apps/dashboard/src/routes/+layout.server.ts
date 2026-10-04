import { LOCALE_COOKIE, resolveLocale } from "$lib/i18n/locales";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies, request }) => {
  const fromCookie = cookies.get(LOCALE_COOKIE);
  const accept = request.headers.get("accept-language") ?? "";
  const locale = resolveLocale(fromCookie ?? accept);
  return { locale };
};
