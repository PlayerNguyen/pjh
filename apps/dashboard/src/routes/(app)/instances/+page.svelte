<script lang="ts">
import { Badge } from "$lib/components/ui/badge";
import * as Card from "$lib/components/ui/card";
import * as Table from "$lib/components/ui/table";
import { formatDuration, formatRelative, statusVariant } from "$lib/format";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const filters = ["", "running", "succeeded", "failed", "timeout", "cancelled"];
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Instances</h1>
		<p class="text-sm text-muted-foreground">Every task execution, newest first.</p>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each filters as f (f)}
			<a href={f ? `?status=${f}` : "/instances"}>
				<Badge variant={data.status === f ? "default" : "outline"}>
					{f || "all"}
				</Badge>
			</a>
		{/each}
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Instance</Table.Head>
						<Table.Head>Task</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Trigger</Table.Head>
						<Table.Head>Duration</Table.Head>
						<Table.Head>Queued</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.instances as inst (inst.id)}
						<Table.Row>
							<Table.Cell>
								<a href={`/instances/${inst.id}`} class="font-mono text-xs hover:underline">
									{inst.id.slice(0, 8)}
								</a>
							</Table.Cell>
							<Table.Cell>
								<a href={`/tasks/${inst.taskId}`} class="text-sm hover:underline">
									{inst.taskId}
								</a>
							</Table.Cell>
							<Table.Cell>
								<Badge variant={statusVariant[inst.status]}>{inst.status}</Badge>
							</Table.Cell>
							<Table.Cell class="text-xs">{inst.trigger}</Table.Cell>
							<Table.Cell class="text-xs">{formatDuration(inst.durationMs)}</Table.Cell>
							<Table.Cell class="text-xs text-muted-foreground">
								{formatRelative(inst.queuedAt)}
							</Table.Cell>
						</Table.Row>
					{/each}
					{#if data.instances.length === 0}
						<Table.Row>
							<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
								No instances found.
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
