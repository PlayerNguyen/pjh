import type { TaskConcurrency, TaskInstanceStatus } from "@pjh/task";

export interface TaskDto {
  id: string;
  name: string;
  description: string | null;
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

export interface InstanceDto {
  id: string;
  taskId: string;
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
  total: number;
  enabled: number;
  running: number;
  byStatus: Record<TaskInstanceStatus, number>;
}

const base = "";

export type Fetch = typeof fetch;

async function request<T>(
  path: string,
  init?: RequestInit,
  fetchFn: Fetch = fetch,
): Promise<T> {
  const res = await fetchFn(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createApi(fetchFn: Fetch = fetch) {
  return {
    health: () =>
      request<{ ok: boolean; time: string }>("/api/health", undefined, fetchFn),
    stats: () => request<StatsDto>("/api/stats", undefined, fetchFn),
    tasks: () => request<TaskDto[]>("/api/tasks", undefined, fetchFn),
    task: (id: string) => request<TaskDto>(`/api/tasks/${id}`, undefined, fetchFn),
    updateTask: (
      id: string,
      patch: {
        enabled?: boolean;
        schedule?: string;
        timezone?: string | null;
        timeoutMs?: number | null;
        concurrency?: TaskConcurrency;
      },
    ) =>
      request<TaskDto>(
        `/api/tasks/${id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
        fetchFn,
      ),
    runTask: (id: string, payload?: unknown) =>
      request<{ instanceId: string }>(
        `/api/tasks/${id}/run`,
        { method: "POST", body: JSON.stringify({ payload }) },
        fetchFn,
      ),
    instances: (params?: {
      taskId?: string;
      status?: TaskInstanceStatus;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.taskId) q.set("taskId", params.taskId);
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
