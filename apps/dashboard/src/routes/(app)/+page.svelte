<script lang="ts">
import { Badge } from "$lib/components/ui/badge";
import * as Card from "$lib/components/ui/card";
import { Separator } from "$lib/components/ui/separator";
import { formatDuration, formatRelative, statusVariant } from "$lib/format";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const cards = $derived([
  { label: "Tasks", value: data.stats.total, sub: `${data.stats.enabled} enabled` },
  { label: "Running", value: data.stats.running, sub: "instances" },
  { label: "Succeeded", value: data.stats.byStatus.succeeded, sub: "all time" },
  { label: "Failed", value: data.stats.byStatus.failed, sub: "all time" },
]);
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Overview</h1>
		<p class="text-sm text-muted-foreground">
			Monitor repetition jobs, upcoming runs and recent executions.
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each cards as c (c.label)}
			<Card.Root>
				<Card.Header class="gap-1">
					<Card.Description>{c.label}</Card.Description>
					<Card.Title class="text-3xl">{c.value}</Card.Title>
					<Card.Description class="text-xs">{c.sub}</Card.Description>
				</Card.Header>
			</Card.Root>
		{/each}
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Upcoming runs</Card.Title>
				<Card.Description>Next scheduled executions</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.upcoming.length === 0}
					<p class="text-sm text-muted-foreground">No scheduled runs.</p>
				{:else}
					<ul class="flex flex-col gap-3">
						{#each data.upcoming as task (task.id)}
							<li class="flex items-center justify-between gap-4">
								<div class="min-w-0">
									<a href={`/tasks/${task.id}`} class="truncate text-sm font-medium hover:underline">
										{task.name}
									</a>
									<p class="truncate font-mono text-xs text-muted-foreground">
										{task.schedule}
									</p>
								</div>
								<span class="shrink-0 text-xs text-muted-foreground">
									{formatRelative(task.nextRunAt)}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent instances</Card.Title>
				<Card.Description>Latest task executions</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.instances.length === 0}
					<p class="text-sm text-muted-foreground">No executions yet.</p>
				{:else}
					<ul class="flex flex-col">
						{#each data.instances as inst (inst.id)}
							<li>
								<a
									href={`/instances/${inst.id}`}
									class="flex items-center justify-between gap-4 py-2 hover:opacity-80"
								>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium">{inst.taskId}</p>
										<p class="text-xs text-muted-foreground">
											{inst.trigger} · {formatDuration(inst.durationMs)}
										</p>
									</div>
									<Badge variant={statusVariant[inst.status]}>{inst.status}</Badge>
								</a>
								<Separator />
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
