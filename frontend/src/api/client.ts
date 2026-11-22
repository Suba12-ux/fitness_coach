import type {
  AuthSession,
  ChangePasswordPayload,
  LoginPayload,
  ReadyResponse,
  RegisterPayload,
  User,
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

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  allowStatuses?: number[];
  skipAuthHandler?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    allowStatuses = [],
    skipAuthHandler = false,
  } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
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

  if (response.status === 401 && !skipAuthHandler) {
    unauthorizedHandler?.();
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

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface ListParams {
  limit?: number;
  offset?: number;
  status?: string;
}

export const api = {
  register(payload: RegisterPayload): Promise<User> {
    return request<User>("/auth/register", {
      method: "POST",
      body: payload,
      skipAuthHandler: true,
    });
  },

  login(payload: LoginPayload): Promise<User> {
    return request<User>("/auth/login", {
      method: "POST",
      body: payload,
      skipAuthHandler: true,
    });
  },

  logout(): Promise<void> {
    return request<void>("/auth/logout", {
      method: "POST",
      skipAuthHandler: true,
    });
  },

  logoutAll(): Promise<void> {
    return request<void>("/auth/logout-all", { method: "POST" });
  },

  me(): Promise<User> {
    return request<User>("/auth/me", { skipAuthHandler: true });
  },

  changePassword(payload: ChangePasswordPayload): Promise<void> {
    return request<void>("/auth/password", {
      method: "POST",
      body: payload,
    });
  },

  listSessions(): Promise<AuthSession[]> {
    return request<AuthSession[]>("/auth/sessions");
  },

  revokeSession(sessionId: string): Promise<void> {
    return request<void>(
      `/auth/sessions/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
    );
  },

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
