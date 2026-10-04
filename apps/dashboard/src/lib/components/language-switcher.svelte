<script lang="ts">
import { Check, Languages } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
import { i18n } from "$lib/i18n";
import { LOCALE_FLAGS, LOCALE_LABELS, LOCALES, type Locale } from "$lib/i18n/locales";

function select(locale: Locale) {
  i18n.setLocale(locale);
}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="sm" class="w-full justify-start gap-2">
				<Languages class="size-4" />
				<span class="group-data-[collapsible=icon]:hidden">
					{LOCALE_FLAGS[i18n.locale]}
					{LOCALE_LABELS[i18n.locale]}
				</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="min-w-40" side="top" align="start">
		<DropdownMenu.Label>{i18n.t("nav.language")}</DropdownMenu.Label>
		{#each LOCALES as locale (locale)}
			<DropdownMenu.Item onclick={() => select(locale)}>
				<span class="mr-2">{LOCALE_FLAGS[locale]}</span>
				{LOCALE_LABELS[locale]}
				{#if i18n.locale === locale}
					<Check class="ml-auto size-4" />
				{/if}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
