import type { TaskConcurrency, TaskInstanceStatus } from "@pjh/task";

export interface StrategyDto {
  type: string;
  name: string;
  description: string | null;
  paramsSchema: JsonSchema;
  defaultSchedule: string | null;
  defaultTimezone: string | null;
  defaultTimeoutMs: number | null;
  defaultConcurrency: TaskConcurrency | null;
}

export interface DelegationDto {
  id: string;
  type: string;
  name: string;
  args: Record<string, unknown>;
  schedule: string;
  timezone: string | null;
  enabled: boolean;
  timeoutMs: number | null;
  concurrency: TaskConcurrency;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  items?: JsonSchemaProperty;
}

export interface JsonSchema {
  type?: string;
  title?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

export interface InstanceDto {
  id: string;
  delegationId: string;
  status: TaskInstanceStatus;
  trigger: "schedule" | "manual" | "retry";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  result: string | null;
  error: string | null;
}

export interface LogDto {
  id: number;
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data: string | null;
}

export interface InstanceDetailDto extends InstanceDto {
  logs: LogDto[];
}

export interface StatsDto {
  strategies: number;
  total: number;
  enabled: number;
  running: number;
  byStatus: Record<TaskInstanceStatus, number>;
}

export type Fetch = typeof fetch;

async function request<T>(
  path: string,
  init?: RequestInit,
  fetchFn: Fetch = fetch,
): Promise<T> {
  const res = await fetchFn(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function createApi(fetchFn: Fetch = fetch) {
  return {
    health: () =>
      request<{ ok: boolean; time: string }>("/api/health", undefined, fetchFn),
    stats: () => request<StatsDto>("/api/stats", undefined, fetchFn),

    strategies: () => request<StrategyDto[]>("/api/strategies", undefined, fetchFn),
    strategy: (type: string) =>
      request<StrategyDto>(`/api/strategies/${type}`, undefined, fetchFn),

    tasks: () => request<DelegationDto[]>("/api/tasks", undefined, fetchFn),
    task: (id: string) =>
      request<DelegationDto>(`/api/tasks/${id}`, undefined, fetchFn),
    createTask: (body: {
      type: string;
      name: string;
      args?: unknown;
      schedule?: string;
      timezone?: string | null;
      enabled?: boolean;
      timeoutMs?: number | null;
      concurrency?: TaskConcurrency;
    }) =>
      request<DelegationDto>(
        "/api/tasks",
        { method: "POST", body: JSON.stringify(body) },
        fetchFn,
      ),
    updateTask: (
      id: string,
      patch: {
        name?: string;
        args?: unknown;
        schedule?: string;
        timezone?: string | null;
        enabled?: boolean;
        timeoutMs?: number | null;
        concurrency?: TaskConcurrency;
      },
    ) =>
      request<DelegationDto>(
        `/api/tasks/${id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
        fetchFn,
      ),
    deleteTask: (id: string) =>
      request<void>(`/api/tasks/${id}`, { method: "DELETE" }, fetchFn),
    runTask: (id: string, payload?: unknown) =>
      request<{ instanceId: string }>(
        `/api/tasks/${id}/run`,
        { method: "POST", body: JSON.stringify({ payload }) },
        fetchFn,
      ),

    instances: (params?: {
      delegationId?: string;
      status?: TaskInstanceStatus;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.delegationId) q.set("delegationId", params.delegationId);
      if (params?.status) q.set("status", params.status);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return request<InstanceDto[]>(
        `/api/instances${qs ? `?${qs}` : ""}`,
        undefined,
        fetchFn,
      );
    },
    instance: (id: string) =>
      request<InstanceDetailDto>(`/api/instances/${id}`, undefined, fetchFn),
    cancelInstance: (id: string) =>
      request<{ ok: boolean }>(
        `/api/instances/${id}/cancel`,
        { method: "POST" },
        fetchFn,
      ),
  };
}

export const api = createApi();
