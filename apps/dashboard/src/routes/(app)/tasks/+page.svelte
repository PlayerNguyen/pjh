<script lang="ts">
import { Play } from "@lucide/svelte";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { api, type TaskDto } from "$lib/api";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { Switch } from "$lib/components/ui/switch";
import * as Table from "$lib/components/ui/table";
import { formatRelative } from "$lib/format";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

let tasks = $state<TaskDto[]>(untrack(() => data.tasks));
const busy = $state<Record<string, boolean>>({});

async function toggle(task: TaskDto, enabled: boolean) {
  busy[task.id] = true;
  try {
    const updated = await api.updateTask(task.id, { enabled });
    tasks = tasks.map((t) => (t.id === task.id ? updated : t));
    toast.success(`${task.name} ${enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Update failed");
  } finally {
    busy[task.id] = false;
  }
}

async function run(task: TaskDto) {
  busy[task.id] = true;
  try {
    const res = await api.runTask(task.id);
    toast.success(`${task.name} started`, { description: res.instanceId });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Run failed");
  } finally {
    busy[task.id] = false;
  }
}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Tasks</h1>
			<p class="text-sm text-muted-foreground">
				Code-defined tasks registered in the core process.
			</p>
		</div>
		<Button variant="outline" href="/instances">View instances</Button>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Task</Table.Head>
						<Table.Head>Schedule</Table.Head>
						<Table.Head>Last run</Table.Head>
						<Table.Head>Next run</Table.Head>
						<Table.Head>Concurrency</Table.Head>
						<Table.Head class="text-right">Enabled</Table.Head>
						<Table.Head class="text-right">Run</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each tasks as task (task.id)}
						<Table.Row>
							<Table.Cell>
								<a href={`/tasks/${task.id}`} class="font-medium hover:underline">
									{task.name}
								</a>
								<div class="font-mono text-xs text-muted-foreground">{task.id}</div>
							</Table.Cell>
							<Table.Cell>
								<code class="rounded bg-muted px-1.5 py-0.5 text-xs">{task.schedule}</code>
								{#if task.timezone}
									<div class="text-xs text-muted-foreground">{task.timezone}</div>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-xs text-muted-foreground">
								{formatRelative(task.lastRunAt)}
							</Table.Cell>
							<Table.Cell class="text-xs text-muted-foreground">
								{task.enabled ? formatRelative(task.nextRunAt) : "—"}
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{task.concurrency}</Badge>
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end">
									<Switch
										checked={task.enabled}
										disabled={busy[task.id]}
										onCheckedChange={(v) => toggle(task, v)}
									/>
								</div>
							</Table.Cell>
							<Table.Cell class="text-right">
								<Button
									size="sm"
									variant="secondary"
									disabled={busy[task.id]}
									onclick={() => run(task)}
								>
									<Play class="size-3.5" />
									Run
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
					{#if tasks.length === 0}
						<Table.Row>
							<Table.Cell colspan={7} class="h-24 text-center text-muted-foreground">
								No tasks registered.
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
