<script lang="ts">
import { Badge } from "$lib/components/ui/badge";
import * as Card from "$lib/components/ui/card";
import { Separator } from "$lib/components/ui/separator";
import { formatDuration, formatRelative, statusVariant } from "$lib/format";
import { i18n } from "$lib/i18n";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const cards = $derived([
  {
    label: i18n.t("overview.cards.tasks"),
    value: data.stats.total,
    sub: i18n.t("overview.cards.tasksSub", { count: data.stats.enabled }),
  },
  {
    label: i18n.t("overview.cards.taskTypes"),
    value: data.stats.strategies,
    sub: i18n.t("overview.cards.taskTypesSub"),
  },
  {
    label: i18n.t("overview.cards.running"),
    value: data.stats.running,
    sub: i18n.t("overview.cards.runningSub"),
  },
  {
    label: i18n.t("overview.cards.failed"),
    value: data.stats.byStatus.failed,
    sub: i18n.t("overview.cards.failedSub"),
  },
]);
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{i18n.t("overview.title")}</h1>
		<p class="text-sm text-muted-foreground">{i18n.t("overview.subtitle")}</p>
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
				<Card.Title>{i18n.t("overview.upcoming")}</Card.Title>
				<Card.Description>{i18n.t("overview.upcomingSub")}</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.upcoming.length === 0}
					<p class="text-sm text-muted-foreground">{i18n.t("overview.noUpcoming")}</p>
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
									{formatRelative(task.nextRunAt, i18n.locale)}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{i18n.t("overview.recent")}</Card.Title>
				<Card.Description>{i18n.t("overview.recentSub")}</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.instances.length === 0}
					<p class="text-sm text-muted-foreground">{i18n.t("overview.noRecent")}</p>
				{:else}
					<ul class="flex flex-col">
						{#each data.instances as inst (inst.id)}
							<li>
								<a
									href={`/instances/${inst.id}`}
									class="flex items-center justify-between gap-4 py-2 hover:opacity-80"
								>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium">{inst.delegationId}</p>
										<p class="text-xs text-muted-foreground">
											{i18n.t(`trigger.${inst.trigger}`)} · {formatDuration(inst.durationMs)}
										</p>
									</div>
									<Badge variant={statusVariant[inst.status]}>
										{i18n.t(`status.${inst.status}`)}
									</Badge>
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
