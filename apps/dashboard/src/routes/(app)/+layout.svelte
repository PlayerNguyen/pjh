<script lang="ts">
import { Activity, LayoutDashboard, ListChecks } from "@lucide/svelte";
import type { Snippet } from "svelte";
import { page } from "$app/state";
import { cn } from "$lib/utils";

let { children }: { children: Snippet } = $props();

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/instances", label: "Instances", icon: Activity },
];
</script>

<div class="min-h-screen bg-background">
	<header class="border-b">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<span
					class="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground"
					>pjh</span
				>
				<span>Pi Job Headless</span>
			</a>
			<nav class="flex items-center gap-1 text-sm">
				{#each nav as item (item.href)}
					{@const active =
						item.href === "/"
							? page.url.pathname === "/"
							: page.url.pathname.startsWith(item.href)}
					<a
						href={item.href}
						class={cn(
							"flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
							active && "bg-accent text-foreground"
						)}
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>
	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
