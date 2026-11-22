import type {
  ReadyResponse,
  WorkflowList,
  WorkflowPayload,
  WorkflowResponse,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  allowStatuses?: number[];
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, allowStatuses = [] } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Нет связи с сервером. Проверьте, что backend запущен.",
      0,
    );
  }

  if (!response.ok && !allowStatuses.includes(response.status)) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === "object" && "detail" in payload) {
        const value = (payload as { detail: unknown }).detail;
        detail = typeof value === "string" ? value : JSON.stringify(value);
      }
    } catch {
      // Тело ответа не JSON — используем общий текст ниже.
    }

    if (response.status === 503) {
      throw new ApiError(
        detail || "Очередь задач недоступна. Проверьте Redis и Worker.",
        503,
      );
    }
    throw new ApiError(
      detail || `Запрос завершился с ошибкой ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export interface ListParams {
  limit?: number;
  offset?: number;
  status?: string;
}

export const api = {
  createWorkflow(payload: WorkflowPayload): Promise<WorkflowResponse> {
    return request<WorkflowResponse>("/workflow", {
      method: "POST",
      body: payload,
    });
  },

  getWorkflow(runId: string): Promise<WorkflowResponse> {
    return request<WorkflowResponse>(`/workflow/${encodeURIComponent(runId)}`);
  },

  listWorkflows(params: ListParams = {}): Promise<WorkflowList> {
    const search = new URLSearchParams();
    search.set("limit", String(params.limit ?? 20));
    search.set("offset", String(params.offset ?? 0));
    if (params.status) {
      search.set("status", params.status);
    }
    return request<WorkflowList>(`/workflow?${search.toString()}`);
  },

  ready(): Promise<ReadyResponse> {
    return request<ReadyResponse>("/ready", { allowStatuses: [503] });
  },
};
