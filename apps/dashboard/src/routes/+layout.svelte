<script lang="ts">
import "../app.css";
import { untrack } from "svelte";
import { Toaster } from "$lib/components/ui/sonner";
import { i18n, initI18n } from "$lib/i18n";
import type { Locale } from "$lib/i18n/locales";
import type { LayoutProps } from "./$types";

let { children, data }: LayoutProps = $props();

initI18n(untrack(() => data.locale as Locale));

$effect(() => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = i18n.locale;
  }
});
</script>

<svelte:head>
	<title>pjh · {i18n.t("app.name")}</title>
	<meta
		name="description"
		content="Dashboard to manage repetition jobs, modularizable by design."
	/>
</svelte:head>

{@render children()}
<Toaster richColors position="top-right" />
