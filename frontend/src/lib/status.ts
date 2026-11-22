export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  hint: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  queued: {
    label: "В очереди",
    tone: "info",
    hint: "Запуск ждёт свободного Worker.",
  },
  running: {
    label: "В работе",
    tone: "info",
    hint: "Агенты собирают план.",
  },
  completed: {
    label: "Готово",
    tone: "success",
    hint: "План успешно собран.",
  },
  needs_info: {
    label: "Нужны данные",
    tone: "warning",
    hint: "В профиле не хватает обязательных полей.",
  },
  failed: {
    label: "Ошибка",
    tone: "danger",
    hint: "Не удалось собрать план.",
  },
  cancelled: {
    label: "Отменён",
    tone: "neutral",
    hint: "Запуск был отменён.",
  },
};

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "needs_info",
  "cancelled",
]);

export function statusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status || "Неизвестно",
      tone: "neutral",
      hint: "Неизвестный статус запуска.",
    }
  );
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isInFlight(status: string): boolean {
  return status === "queued" || status === "running";
}
