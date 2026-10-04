<script lang="ts">
import { Play, Trash2 } from "@lucide/svelte";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { api, type DelegationDto, type StrategyDto } from "$lib/api";
import CreateTaskDialog from "$lib/components/create-task-dialog.svelte";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { Switch } from "$lib/components/ui/switch";
import * as Table from "$lib/components/ui/table";
import { formatRelative } from "$lib/format";
import { i18n } from "$lib/i18n";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

let tasks = $state<DelegationDto[]>(untrack(() => data.tasks));
const strategies: StrategyDto[] = untrack(() => data.strategies);
const busy = $state<Record<string, boolean>>({});

function strategyName(type: string) {
  return strategies.find((s) => s.type === type)?.name ?? type;
}

async function toggle(task: DelegationDto, enabled: boolean) {
  busy[task.id] = true;
  try {
    const updated = await api.updateTask(task.id, { enabled });
    tasks = tasks.map((t) => (t.id === task.id ? updated : t));
    toast.success(
      enabled
        ? i18n.t("tasks.enabledToast", { name: task.name })
        : i18n.t("tasks.disabledToast", { name: task.name }),
    );
  } catch (error) {
    toast.error(error instanceof Error ? error.message : i18n.t("inputs.updateFailed"));
  } finally {
    busy[task.id] = false;
  }
}

async function run(task: DelegationDto) {
  busy[task.id] = true;
  try {
    const res = await api.runTask(task.id);
    toast.success(i18n.t("tasks.startedToast", { name: task.name }), {
      description: res.instanceId,
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : i18n.t("inputs.runFailed"));
  } finally {
    busy[task.id] = false;
  }
}

async function remove(task: DelegationDto) {
  busy[task.id] = true;
  try {
    await api.deleteTask(task.id);
    tasks = tasks.filter((t) => t.id !== task.id);
    toast.success(i18n.t("tasks.deletedToast", { name: task.name }));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : i18n.t("tasks.deleteFailed"));
  } finally {
    busy[task.id] = false;
  }
}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">{i18n.t("tasks.title")}</h1>
			<p class="text-sm text-muted-foreground">{i18n.t("tasks.subtitle")}</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" href="/instances">{i18n.t("tasks.viewInstances")}</Button>
			<CreateTaskDialog {strategies} oncreated={(task) => (tasks = [task, ...tasks])} />
		</div>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{i18n.t("tasks.columnTask")}</Table.Head>
						<Table.Head>{i18n.t("tasks.columnType")}</Table.Head>
						<Table.Head>{i18n.t("tasks.columnArgs")}</Table.Head>
						<Table.Head>{i18n.t("tasks.columnSchedule")}</Table.Head>
						<Table.Head>{i18n.t("tasks.columnNextRun")}</Table.Head>
						<Table.Head class="text-right">{i18n.t("tasks.columnEnabled")}</Table.Head>
						<Table.Head class="text-right">{i18n.t("tasks.columnActions")}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each tasks as task (task.id)}
						<Table.Row>
							<Table.Cell>
								<a href={`/tasks/${task.id}`} class="font-medium hover:underline">
									{task.name}
								</a>
								<div class="text-xs text-muted-foreground">
									{i18n.t("tasks.lastRun", {
										when: formatRelative(task.lastRunAt, i18n.locale)
									})}
								</div>
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{strategyName(task.type)}</Badge>
							</Table.Cell>
							<Table.Cell>
								<code class="text-xs text-muted-foreground">
									{JSON.stringify(task.args)}
								</code>
							</Table.Cell>
							<Table.Cell>
								<code class="rounded bg-muted px-1.5 py-0.5 text-xs">{task.schedule}</code>
								{#if task.timezone}
									<div class="text-xs text-muted-foreground">{task.timezone}</div>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-xs text-muted-foreground">
								{task.enabled ? formatRelative(task.nextRunAt, i18n.locale) : "—"}
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
								<div class="flex justify-end gap-1">
									<Button
										size="icon"
										variant="secondary"
										title={i18n.t("common.run")}
										disabled={busy[task.id]}
										onclick={() => run(task)}
									>
										<Play class="size-3.5" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										title={i18n.t("common.delete")}
										disabled={busy[task.id]}
										onclick={() => remove(task)}
									>
										<Trash2 class="size-3.5" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
					{#if tasks.length === 0}
						<Table.Row>
							<Table.Cell colspan={7} class="h-24 text-center text-muted-foreground">
								{i18n.t("tasks.empty")}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
