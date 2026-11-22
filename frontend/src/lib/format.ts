const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Новичок",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Новичок", hint: "до 6 месяцев" },
  { value: "intermediate", label: "Средний", hint: "6–24 месяца" },
  { value: "advanced", label: "Продвинутый", hint: "2+ года" },
] as const;

export function experienceLabel(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return EXPERIENCE_LABELS[value] ?? value;
}

export function capitalizeFirst(text: string): string {
  if (!text) {
    return text;
  }
  return text.charAt(0).toLocaleUpperCase("ru-RU") + text.slice(1);
}

/**
 * SQLite отдаёт время без таймзоны, хотя backend хранит его в UTC.
 * Строки без смещения трактуем как UTC, чтобы браузер показал локальное время.
 */
export function parseApiDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value?: string | null): string {
  const date = parseApiDate(value);
  if (!date) {
    return "—";
  }
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", " ·");
}

export function formatDate(value?: string | null): string {
  const date = parseApiDate(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Дата без времени (`YYYY-MM-DD`), без сдвига часового пояса. */
export function formatDateOnly(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return value;
  }
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatDuration(
  startedAt?: string | null,
  finishedAt?: string | null,
): string | null {
  const start = parseApiDate(startedAt);
  const end = parseApiDate(finishedAt);
  if (!start || !end) {
    return null;
  }
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (seconds < 1) {
    return "< 1 с";
  }
  if (seconds < 60) {
    return `${seconds} с`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

export function pluralize(
  count: number,
  forms: [string, string, string],
): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) {
    return forms[2];
  }
  if (last === 1) {
    return forms[0];
  }
  if (last >= 2 && last <= 4) {
    return forms[1];
  }
  return forms[2];
}

const FIELD_LABELS: Record<string, string> = {
  goal: "Цель",
  age: "Возраст",
  weight_kg: "Вес",
  height_cm: "Рост",
  experience_level: "Уровень подготовки",
  days_per_week: "Дней в неделю",
  minutes_per_session: "Минут на занятие",
  limitations: "Ограничения",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
