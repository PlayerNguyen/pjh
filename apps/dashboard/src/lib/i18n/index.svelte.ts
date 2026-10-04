import { en, type Messages } from "./en.ts";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales.ts";
import { vi } from "./vi.ts";

export const dictionaries: Record<Locale, Messages> = { en, vi };

type Params = Record<string, string | number>;

function lookup(messages: Messages, key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      messages,
    );
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * App-wide reactive locale state. Created once per request on the server
 * (from the cookie) and mutated on the client when the user switches language.
 */
class I18nState {
  locale = $state<Locale>(DEFAULT_LOCALE);

  init(locale: Locale) {
    this.locale = locale;
  }

  t = (key: string, params?: Params): string => {
    const translated = lookup(dictionaries[this.locale], key) ?? lookup(en, key) ?? key;
    return interpolate(translated, params);
  };

	setLocale = (locale: Locale): void => {
		this.locale = locale;
		if (typeof document !== "undefined") {
			// biome-ignore lint/suspicious/noDocumentCookie: simple locale preference cookie
			document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
			document.documentElement.lang = locale;
		}
	};
}

export const i18n = new I18nState();
export const t = i18n.t;

/** Initialize the locale for the current page render. */
export function initI18n(locale: Locale): void {
  i18n.init(locale);
}

export type { Locale, Messages };
export { DEFAULT_LOCALE, LOCALE_COOKIE };
