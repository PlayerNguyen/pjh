<script lang="ts">
import { Plus } from "@lucide/svelte";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { api, type DelegationDto, type StrategyDto } from "$lib/api";
import ArgsForm from "$lib/components/args-form.svelte";
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";
import * as Select from "$lib/components/ui/select";
import { i18n } from "$lib/i18n";
import { schemaToFields } from "$lib/schema";

interface Props {
  strategies: StrategyDto[];
  oncreated: (task: DelegationDto) => void;
}

let { strategies, oncreated }: Props = $props();

let open = $state(false);
let submitting = $state(false);

let type = $state(untrack(() => strategies[0]?.type ?? ""));
let name = $state("");
let schedule = $state("");
let timezone = $state("");
let args = $state<Record<string, unknown>>({});

const selected = $derived(strategies.find((s) => s.type === type));
const fields = $derived(selected ? schemaToFields(selected.paramsSchema) : []);

function reset() {
  type = strategies[0]?.type ?? "";
  name = "";
  schedule = "";
  timezone = "";
  args = {};
}

function onOpen(next: boolean) {
  open = next;
  if (next) reset();
}

async function submit() {
  if (!type || !name.trim()) {
    toast.error(i18n.t("createDialog.requiredError"));
    return;
  }
  submitting = true;
  try {
    const task = await api.createTask({
      type,
      name: name.trim(),
      args,
      schedule: schedule.trim() || undefined,
      timezone: timezone.trim() === "" ? undefined : timezone.trim(),
    });
    oncreated(task);
    toast.success(i18n.t("createDialog.createdToast", { name: task.name }));
    open = false;
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : i18n.t("createDialog.createFailed"),
    );
  } finally {
    submitting = false;
  }
}
</script>

<Dialog.Root bind:open onOpenChange={onOpen}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props}>
				<Plus class="size-4" />
				{i18n.t("tasks.newTask")}
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{i18n.t("createDialog.title")}</Dialog.Title>
			<Dialog.Description>{i18n.t("createDialog.description")}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 py-2">
			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">{i18n.t("createDialog.type")}</span>
				<Select.Root type="single" bind:value={type}>
					<Select.Trigger class="w-full">
						{type || i18n.t("createDialog.selectType")}
					</Select.Trigger>
					<Select.Content>
						{#each strategies as s (s.type)}
							<Select.Item value={s.type} label={s.name}>{s.name} ({s.type})</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				{#if selected?.description}
					<p class="text-xs text-muted-foreground">{selected.description}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<label for="task-name" class="text-sm font-medium">
					{i18n.t("createDialog.name")}
				</label>
				<Input
					id="task-name"
					bind:value={name}
					placeholder={i18n.t("createDialog.namePlaceholder")}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col gap-2">
					<label for="task-schedule" class="text-sm font-medium">
						{i18n.t("createDialog.schedule")}
					</label>
					<Input
						id="task-schedule"
						bind:value={schedule}
						placeholder={selected?.defaultSchedule ?? "@daily"}
					/>
				</div>
				<div class="flex flex-col gap-2">
					<label for="task-tz" class="text-sm font-medium">
						{i18n.t("createDialog.timezone")}
					</label>
					<Input
						id="task-tz"
						bind:value={timezone}
						placeholder={selected?.defaultTimezone ?? i18n.t("createDialog.serverDefault")}
					/>
				</div>
			</div>

			<div class="border-t pt-4">
				<p class="mb-3 text-sm font-medium">{i18n.t("createDialog.arguments")}</p>
				<ArgsForm {fields} bind:values={args} />
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>{i18n.t("common.cancel")}</Button>
			<Button onclick={submit} disabled={submitting}>{i18n.t("common.create")}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
