<script lang="ts">
import { Badge } from "$lib/components/ui/badge";
import * as Card from "$lib/components/ui/card";
import * as Table from "$lib/components/ui/table";
import { formatDuration, formatRelative, statusVariant } from "$lib/format";
import { i18n } from "$lib/i18n";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const filters = ["", "running", "succeeded", "failed", "timeout", "cancelled"];
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{i18n.t("instances.title")}</h1>
		<p class="text-sm text-muted-foreground">{i18n.t("instances.subtitle")}</p>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each filters as f (f)}
			<a href={f ? `?status=${f}` : "/instances"}>
				<Badge variant={data.status === f ? "default" : "outline"}>
					{f ? i18n.t(`status.${f}`) : i18n.t("common.all")}
				</Badge>
			</a>
		{/each}
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{i18n.t("instances.columnInstance")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnTask")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnStatus")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnTrigger")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnDuration")}</Table.Head>
						<Table.Head>{i18n.t("instances.columnQueued")}</Table.Head>
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
								<a href={`/tasks/${inst.delegationId}`} class="text-sm hover:underline">
									{inst.delegationId}
								</a>
							</Table.Cell>
							<Table.Cell>
								<Badge variant={statusVariant[inst.status]}>
									{i18n.t(`status.${inst.status}`)}
								</Badge>
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
							<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
								{i18n.t("instances.empty")}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
