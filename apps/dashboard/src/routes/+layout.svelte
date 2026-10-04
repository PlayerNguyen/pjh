<script lang="ts">
import "../app.css";
import { Toaster } from "$lib/components/ui/sonner";
import type { LayoutProps } from "./$types";

let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>pjh · Pi Job Headless</title>
	<meta
		name="description"
		content="Dashboard to manage repetition jobs, modularizable by design."
	/>
</svelte:head>

{@render children()}
<Toaster richColors position="top-right" />
