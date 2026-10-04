<script lang="ts">
import { Input } from "$lib/components/ui/input";
import * as Select from "$lib/components/ui/select";
import { Switch } from "$lib/components/ui/switch";
import { i18n } from "$lib/i18n";
import type { FieldDescriptor } from "$lib/schema";

interface Props {
  fields: FieldDescriptor[];
  values: Record<string, unknown>;
}

let { fields, values = $bindable() }: Props = $props();

function setValue(name: string, value: unknown) {
  values = { ...values, [name]: value };
}

function numberValue(name: string, raw: string) {
  if (raw === "") {
    const next = { ...values };
    delete next[name];
    values = next;
    return;
  }
  setValue(name, Number(raw));
}
</script>

{#if fields.length === 0}
	<p class="text-sm text-muted-foreground">{i18n.t("args.empty")}</p>
{:else}
	<div class="flex flex-col gap-4">
		{#each fields as field (field.name)}
			<div class="flex flex-col gap-2">
				<label for={`arg-${field.name}`} class="text-sm font-medium">
					{field.label}
					{#if field.required}<span class="text-destructive">*</span>{/if}
				</label>

				{#if field.type === "boolean"}
					<Switch
						id={`arg-${field.name}`}
						checked={Boolean(values[field.name])}
						onCheckedChange={(v) => setValue(field.name, v)}
					/>
				{:else if field.type === "select"}
					<Select.Root
						type="single"
						value={(values[field.name] as string) ?? ""}
						onValueChange={(v) => setValue(field.name, v)}
					>
						<Select.Trigger class="w-full">
							{(values[field.name] as string) || i18n.t("args.select")}
						</Select.Trigger>
						<Select.Content>
							{#each field.options ?? [] as opt (opt.value)}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{:else if field.type === "number" || field.type === "integer"}
					<Input
						id={`arg-${field.name}`}
						type="number"
						min={field.minimum}
						max={field.maximum}
						step={field.type === "integer" ? 1 : "any"}
						value={values[field.name] === undefined ? "" : String(values[field.name])}
						oninput={(e) => numberValue(field.name, e.currentTarget.value)}
					/>
				{:else}
					<Input
						id={`arg-${field.name}`}
						value={(values[field.name] as string) ?? ""}
						oninput={(e) => setValue(field.name, e.currentTarget.value)}
					/>
				{/if}

				{#if field.description}
					<p class="text-xs text-muted-foreground">{field.description}</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
