<script lang="ts">
import type { Snippet } from "svelte";
import { page } from "$app/state";
import LanguageSwitcher from "$lib/components/language-switcher.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb";
import * as Sidebar from "$lib/components/ui/sidebar";
import { i18n } from "$lib/i18n";
import { isActive, navCategories } from "$lib/nav";
import { crumbsFor, pageTitleKey } from "./breadcrumbs";

let { children }: { children: Snippet } = $props();

const crumbs = $derived(crumbsFor(page.url.pathname));
const titleKey = $derived(pageTitleKey(page.url.pathname));
const title = $derived(titleKey ? i18n.t(titleKey) : "");

function crumbLabel(crumb: { labelKey?: string; label?: string }): string {
  return crumb.labelKey ? i18n.t(crumb.labelKey) : (crumb.label ?? "");
}
</script>

<Sidebar.Provider>
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<a href="/" class="flex items-center gap-2 px-2 py-1.5">
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
							>pjh</span
						>
						<span class="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
							<span class="text-sm font-semibold">{i18n.t("app.name")}</span>
							<span class="text-xs text-muted-foreground">{i18n.t("app.tagline")}</span>
						</span>
					</a>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header>

		<Sidebar.Content>
			{#each navCategories as category (category.labelKey)}
				<Sidebar.Group>
					<Sidebar.GroupLabel>{i18n.t(category.labelKey)}</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each category.items as item (item.href)}
								{@const label = i18n.t(item.labelKey)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={isActive(item, page.url.pathname)}
										tooltipContent={label}
									>
										{#snippet child({ props })}
											<a href={item.href} {...props}>
												<item.icon />
												<span>{label}</span>
											</a>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/each}
		</Sidebar.Content>

		<Sidebar.Footer class="flex flex-col gap-2">
			<LanguageSwitcher />
			<div
				class="px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
			>
				{i18n.t("app.noAuth")}
			</div>
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Root>

	<Sidebar.Inset>
		<header
			class="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur"
		>
			<Sidebar.Trigger />
			<Sidebar.Separator class="mr-1 h-4 data-[orientation=vertical]:h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each crumbs as crumb, i (crumb.href ?? crumb.labelKey ?? crumb.label)}
						<Breadcrumb.Item>
							{#if crumb.href && i < crumbs.length - 1}
								<Breadcrumb.Link href={crumb.href}>{crumbLabel(crumb)}</Breadcrumb.Link>
							{:else}
								<Breadcrumb.Page>{crumbLabel(crumb)}</Breadcrumb.Page>
							{/if}
						</Breadcrumb.Item>
						{#if i < crumbs.length - 1}
							<Breadcrumb.Separator />
						{/if}
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>

		<div class="flex-1 p-4 lg:p-6">
			<h1 class="sr-only">{title}</h1>
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
