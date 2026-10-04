<script lang="ts">
import { Play, Save } from "@lucide/svelte";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { api, type DelegationDto } from "$lib/api";
import ArgsForm from "$lib/components/args-form.svelte";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { Input } from "$lib/components/ui/input";
import * as Select from "$lib/components/ui/select";
import { Switch } from "$lib/components/ui/switch";
import * as Table from "$lib/components/ui/table";
import { formatDuration, formatRelative, statusVariant } from "$lib/format";
import { i18n } from "$lib/i18n";
import { schemaToFields } from "$lib/schema";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

let task = $state<DelegationDto>(untrack(() => data.task));
let schedule = $state(untrack(() => data.task.schedule));
let timezone = $state(untrack(() => data.task.timezone ?? ""));
let timeoutMs = $state(untrack(() => data.task.timeoutMs?.toString() ?? ""));
let concurrency = $state(untrack(() => data.task.concurrency));
let args = $state<Record<string, unknown>>(untrack(() => ({ ...data.task.args })));
let saving = $state(false);

const fields = schemaToFields(untrack(() => data.strategy.paramsSchema));

const concurrencyOptions = $derived([
  { value: "skip", label: i18n.t("concurrency.skip") },
  { value: "queue", label: i18n.t("concurrency.queue") },
  { value: "parallel", label: i18n.t("concurrency.parallel") },
]);

async function save() {
  saving = true;
  try {
    task = await api.updateTask(task.id, {
      args,
      schedule,
      timezone: timezone.trim() === "" ? null : timezone.trim(),
      timeoutMs: timeoutMs.trim() === "" ? null : Number(timeoutMs),
      concurrency: concurrency as DelegationDto["concurrency"],
    });
    toast.success(i18n.t("taskDetail.updatedToast"));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : i18n.t("inputs.updateFailed"));
  } finally {
    saving = false;
  }
}

async function toggle(enabled: boolean) {
  try {
    task = await api.updateTask(task.id, { enabled });
    toast.success(
      enabled
        ? i18n.t("tasks.enabledToast", { name: task.name })
        : i18n.t("tasks.disabledToast", { name: task.name }),
    );
  } catch (error) {
    toast.error(error instanceof Error ? error.message : i18n.t("inputs.updateFailed"));
  }
}

async function run() {
  try {
    const res = await api.runTask(task.id);
    toast.success(i18n.t("taskDetail.runStartedToast"), {
      description: res.instanceId,
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : i18n.t("inputs.runFailed"));
  }
}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-semibold tracking-tight">{task.name}</h1>
				<Badge variant={task.enabled ? "default" : "outline"}>
					{task.enabled ? i18n.t("common.enabled") : i18n.t("common.disabled")}
				</Badge>
				<Badge variant="secondary">{data.strategy.name}</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				{data.strategy.description ?? i18n.t("common.noDescription")}
			</p>
			<code class="text-xs text-muted-foreground">{task.id}</code>
		</div>
		<div class="flex items-center gap-3">
			<Switch checked={task.enabled} onCheckedChange={toggle} />
			<Button onclick={run}>
				<Play class="size-4" />
				{i18n.t("common.run")}
			</Button>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>{i18n.t("taskDetail.arguments")}</Card.Title>
				<Card.Description>
					{i18n.t("taskDetail.argumentsSub", { type: task.type })}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ArgsForm {fields} bind:values={args} />
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{i18n.t("taskDetail.schedule")}</Card.Title>
				<Card.Description>{i18n.t("taskDetail.scheduleSub")}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<label for="schedule" class="text-sm font-medium">
						{i18n.t("taskDetail.cronSchedule")}
					</label>
					<Input id="schedule" bind:value={schedule} placeholder="*/5 * * * *" />
				</div>
				<div class="flex flex-col gap-2">
					<label for="timezone" class="text-sm font-medium">
						{i18n.t("taskDetail.timezone")}
					</label>
					<Input id="timezone" bind:value={timezone} placeholder="America/New_York" />
				</div>
				<div class="flex flex-col gap-2">
					<label for="timeout" class="text-sm font-medium">
						{i18n.t("taskDetail.timeout")}
					</label>
					<Input id="timeout" bind:value={timeoutMs} type="number" placeholder="30000" />
				</div>
				<div class="flex flex-col gap-2">
					<span class="text-sm font-medium">{i18n.t("taskDetail.concurrency")}</span>
					<Select.Root type="single" bind:value={concurrency}>
						<Select.Trigger class="w-full">
							{concurrencyOptions.find((o) => o.value === concurrency)?.label ?? concurrency}
						</Select.Trigger>
						<Select.Content>
							{#each concurrencyOptions as opt (opt.value)}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<Button onclick={save} disabled={saving}>
					<Save class="size-4" />
					{i18n.t("common.save")}
				</Button>
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{i18n.t("taskDetail.recentRuns")}</Card.Title>
			<Card.Description>
				{i18n.t("taskDetail.recentRunsSub", { count: data.instances.length })}
			</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{i18n.t("instances.columnStatus")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnTrigger")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnDuration")}</Table.Head>
						<Table.Head>{i18n.t("instanceDetail.started")}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.instances as inst (inst.id)}
						<Table.Row>
							<Table.Cell>
								<a href={`/instances/${inst.id}`}>
									<Badge variant={statusVariant[inst.status]}>
										{i18n.t(`status.${inst.status}`)}
									</Badge>
								</a>
							</Table.Cell>
							<Table.Cell class="text-xs">{i18n.t(`trigger.${inst.trigger}`)}</Table.Cell>
							<Table.Cell class="text-xs">{formatDuration(inst.durationMs)}</Table.Cell>
							<Table.Cell class="text-xs text-muted-foreground">
								{formatRelative(inst.queuedAt, i18n.locale)}
							</Table.Cell>
						</Table.Row>
					{/each}
					{#if data.instances.length === 0}
						<Table.Row>
							<Table.Cell colspan={4} class="h-20 text-center text-muted-foreground">
								{i18n.t("taskDetail.noRuns")}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
