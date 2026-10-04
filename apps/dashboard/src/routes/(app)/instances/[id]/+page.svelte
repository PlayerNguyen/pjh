<script lang="ts">
import { Ban } from "@lucide/svelte";
import { toast } from "svelte-sonner";
import { api } from "$lib/api";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { Separator } from "$lib/components/ui/separator";
import { formatDate, formatDuration, statusVariant } from "$lib/format";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const instance = $derived(data.instance);

async function cancel() {
  try {
    await api.cancelInstance(instance.id);
    toast.success("Cancellation requested");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Cancel failed");
  }
}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="font-mono text-xl font-semibold">{instance.id}</h1>
				<Badge variant={statusVariant[instance.status]}>{instance.status}</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				Task <a href={`/tasks/${instance.taskId}`} class="hover:underline">{instance.taskId}</a>
				· triggered by {instance.trigger}
			</p>
		</div>
		{#if instance.status === "running"}
			<Button variant="destructive" onclick={cancel}>
				<Ban class="size-4" />
				Cancel
			</Button>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>Started</Card.Description>
				<Card.Title class="text-sm font-medium">{formatDate(instance.startedAt)}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>Finished</Card.Description>
				<Card.Title class="text-sm font-medium">{formatDate(instance.finishedAt)}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>Duration</Card.Description>
				<Card.Title class="text-sm font-medium">{formatDuration(instance.durationMs)}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>Trigger</Card.Description>
				<Card.Title class="text-sm font-medium">{instance.trigger}</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	{#if instance.error}
		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title class="text-destructive">Error</Card.Title>
			</Card.Header>
			<Card.Content>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{instance.error}</pre>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if instance.result}
		<Card.Root>
			<Card.Header>
				<Card.Title>Result</Card.Title>
			</Card.Header>
			<Card.Content>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{instance.result}</pre>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Logs</Card.Title>
			<Card.Description>{instance.logs.length} line(s)</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<ul class="flex flex-col">
				{#each instance.logs as log (log.id)}
					<li class="flex items-start gap-3 px-4 py-2 font-mono text-xs">
						<span class="shrink-0 text-muted-foreground">{formatDate(log.ts)}</span>
						<Badge variant={log.level === "error" ? "destructive" : "outline"}>{log.level}</Badge>
						<span class="min-w-0 flex-1 whitespace-pre-wrap">{log.message}</span>
					</li>
					<Separator />
				{/each}
				{#if instance.logs.length === 0}
					<li class="p-6 text-center text-sm text-muted-foreground">No logs.</li>
				{/if}
			</ul>
		</Card.Content>
	</Card.Root>
</div>
