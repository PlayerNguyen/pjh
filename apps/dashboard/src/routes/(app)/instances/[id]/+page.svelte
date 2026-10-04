<script lang="ts">
import { Ban } from "@lucide/svelte";
import { toast } from "svelte-sonner";
import { api } from "$lib/api";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Card from "$lib/components/ui/card";
import { Separator } from "$lib/components/ui/separator";
import { formatDate, formatDuration, statusVariant } from "$lib/format";
import { i18n } from "$lib/i18n";
import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const instance = $derived(data.instance);

async function cancel() {
  try {
    await api.cancelInstance(instance.id);
    toast.success(i18n.t("instanceDetail.cancelRequested"));
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : i18n.t("instanceDetail.cancelFailed"),
    );
  }
}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="font-mono text-xl font-semibold">{instance.id}</h1>
				<Badge variant={statusVariant[instance.status]}>
					{i18n.t(`status.${instance.status}`)}
				</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				{i18n.t("instanceDetail.task")}
				<a href={`/tasks/${instance.delegationId}`} class="hover:underline"
					>{instance.delegationId}</a
				>
				· {i18n.t("instanceDetail.triggeredBy", { trigger: i18n.t(`trigger.${instance.trigger}`) })}
			</p>
		</div>
		{#if instance.status === "running"}
			<Button variant="destructive" onclick={cancel}>
				<Ban class="size-4" />
				{i18n.t("instanceDetail.cancel")}
			</Button>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>{i18n.t("instanceDetail.started")}</Card.Description>
				<Card.Title class="text-sm font-medium"
					>{formatDate(instance.startedAt, i18n.locale)}</Card.Title
				>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>{i18n.t("instanceDetail.finished")}</Card.Description>
				<Card.Title class="text-sm font-medium"
					>{formatDate(instance.finishedAt, i18n.locale)}</Card.Title
				>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>{i18n.t("instanceDetail.duration")}</Card.Description>
				<Card.Title class="text-sm font-medium">{formatDuration(instance.durationMs)}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="gap-1">
				<Card.Description>{i18n.t("instanceDetail.trigger")}</Card.Description>
				<Card.Title class="text-sm font-medium">{i18n.t(`trigger.${instance.trigger}`)}</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	{#if instance.error}
		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title class="text-destructive">{i18n.t("instanceDetail.error")}</Card.Title>
			</Card.Header>
			<Card.Content>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{instance.error}</pre>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if instance.result}
		<Card.Root>
			<Card.Header>
				<Card.Title>{i18n.t("instanceDetail.result")}</Card.Title>
			</Card.Header>
			<Card.Content>
				<pre class="overflow-auto whitespace-pre-wrap text-xs">{instance.result}</pre>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>{i18n.t("instanceDetail.logs")}</Card.Title>
			<Card.Description>
				{i18n.t("instanceDetail.logLines", { count: instance.logs.length })}
			</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<ul class="flex flex-col">
				{#each instance.logs as log (log.id)}
					<li class="flex items-start gap-3 px-4 py-2 font-mono text-xs">
						<span class="shrink-0 text-muted-foreground">{formatDate(log.ts, i18n.locale)}</span>
						<Badge variant={log.level === "error" ? "destructive" : "outline"}>{log.level}</Badge>
						<span class="min-w-0 flex-1 whitespace-pre-wrap">{log.message}</span>
					</li>
					<Separator />
				{/each}
				{#if instance.logs.length === 0}
					<li class="p-6 text-center text-sm text-muted-foreground">
						{i18n.t("instanceDetail.noLogs")}
					</li>
				{/if}
			</ul>
		</Card.Content>
	</Card.Root>
</div>
