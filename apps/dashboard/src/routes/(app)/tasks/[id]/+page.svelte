<script lang="ts">
import { Play, Save } from "@lucide/svelte";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { api, type TaskDto } from "$lib/api";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { Input } from "$lib/components/ui/input";
import * as Select from "$lib/components/ui/select";
import { Switch } from "$lib/components/ui/switch";
import * as Table from "$lib/components/ui/table";
import { formatDuration, formatRelative, statusVariant } from "$lib/format";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

let task = $state<TaskDto>(untrack(() => data.task));
let schedule = $state(untrack(() => data.task.schedule));
let timezone = $state(untrack(() => data.task.timezone ?? ""));
let timeoutMs = $state(untrack(() => data.task.timeoutMs?.toString() ?? ""));
let concurrency = $state(untrack(() => data.task.concurrency));
let saving = $state(false);

const concurrencyOptions = [
  { value: "skip", label: "Skip if running" },
  { value: "queue", label: "Queue" },
  { value: "parallel", label: "Parallel" },
];

async function save() {
  saving = true;
  try {
    task = await api.updateTask(task.id, {
      schedule,
      timezone: timezone.trim() === "" ? null : timezone.trim(),
      timeoutMs: timeoutMs.trim() === "" ? null : Number(timeoutMs),
      concurrency: concurrency as TaskDto["concurrency"],
    });
    toast.success("Task updated");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Update failed");
  } finally {
    saving = false;
  }
}

async function toggle(enabled: boolean) {
  try {
    task = await api.updateTask(task.id, { enabled });
    toast.success(`${task.name} ${enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Update failed");
  }
}

async function run() {
  try {
    const res = await api.runTask(task.id);
    toast.success("Task run started", { description: res.instanceId });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Run failed");
  }
}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-semibold tracking-tight">{task.name}</h1>
				<Badge variant={task.enabled ? "default" : "outline"}>
					{task.enabled ? "enabled" : "disabled"}
				</Badge>
			</div>
			<p class="text-sm text-muted-foreground">{task.description ?? "No description"}</p>
			<code class="text-xs text-muted-foreground">{task.id}</code>
		</div>
		<div class="flex items-center gap-3">
			<Switch checked={task.enabled} onCheckedChange={toggle} />
			<Button onclick={run}>
				<Play class="size-4" />
				Run now
			</Button>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Configuration</Card.Title>
				<Card.Description>Runtime settings for this task.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<label for="schedule" class="text-sm font-medium">Cron schedule</label>
					<Input id="schedule" bind:value={schedule} placeholder="*/5 * * * *" />
				</div>
				<div class="flex flex-col gap-2">
					<label for="timezone" class="text-sm font-medium">Timezone</label>
					<Input id="timezone" bind:value={timezone} placeholder="America/New_York" />
				</div>
				<div class="flex flex-col gap-2">
					<label for="timeout" class="text-sm font-medium">Timeout (ms)</label>
					<Input id="timeout" bind:value={timeoutMs} type="number" placeholder="30000" />
				</div>
				<div class="flex flex-col gap-2">
					<span class="text-sm font-medium">Concurrency</span>
					<Select.Root type="single" bind:value={concurrency}>
						<Select.Trigger class="w-full">{concurrency}</Select.Trigger>
						<Select.Content>
							{#each concurrencyOptions as opt (opt.value)}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<Button onclick={save} disabled={saving}>
					<Save class="size-4" />
					Save changes
				</Button>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent runs</Card.Title>
				<Card.Description>Last {data.instances.length} executions.</Card.Description>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Status</Table.Head>
							<Table.Head>Trigger</Table.Head>
							<Table.Head>Duration</Table.Head>
							<Table.Head>Started</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.instances as inst (inst.id)}
							<Table.Row>
								<Table.Cell>
									<a href={`/instances/${inst.id}`}>
										<Badge variant={statusVariant[inst.status]}>{inst.status}</Badge>
									</a>
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
								<Table.Cell colspan={4} class="h-20 text-center text-muted-foreground">
									No runs yet.
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>
</div>
