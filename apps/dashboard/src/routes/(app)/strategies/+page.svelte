<script lang="ts">
import { Badge } from "$lib/components/ui/badge";
import * as Card from "$lib/components/ui/card";
import { i18n } from "$lib/i18n";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

function paramCount(schema: Record<string, unknown>): number {
  const properties = schema.properties as Record<string, unknown> | undefined;
  return properties ? Object.keys(properties).length : 0;
}
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{i18n.t("strategies.title")}</h1>
		<p class="text-sm text-muted-foreground">{i18n.t("strategies.subtitle")}</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		{#each data.strategies as strategy (strategy.type)}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between gap-2">
						<Card.Title>{strategy.name}</Card.Title>
						<Badge variant="outline">{strategy.type}</Badge>
					</div>
					<Card.Description>
						{strategy.description ?? i18n.t("common.noDescription")}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3 text-sm">
					<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
						<span class="rounded bg-muted px-1.5 py-0.5">
							{i18n.t("strategies.paramCount", {
								count: paramCount(strategy.paramsSchema)
							})}
						</span>
						{#if strategy.defaultSchedule}
							<span class="rounded bg-muted px-1.5 py-0.5">
								{i18n.t("strategies.defaultLabel", { value: strategy.defaultSchedule })}
							</span>
						{/if}
						{#if strategy.defaultConcurrency}
							<span class="rounded bg-muted px-1.5 py-0.5">
								{i18n.t(`concurrency.${strategy.defaultConcurrency}`)}
							</span>
						{/if}
					</div>
					<pre
						class="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(
							strategy.paramsSchema,
							null,
							2
						)}</pre>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	{#if data.strategies.length === 0}
		<p class="text-sm text-muted-foreground">{i18n.t("strategies.empty")}</p>
	{/if}
</div>
