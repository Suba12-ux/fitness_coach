import type { WorkoutSet, WorkoutSetPayload } from "../api/types";

export interface SetDraft {
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  skipped: boolean;
}

export interface SetColumns {
  reps: boolean;
  weight: boolean;
  duration: boolean;
  distance: boolean;
}

export const EMPTY_SET_DRAFT: SetDraft = {
  reps: "",
  weight: "",
  duration: "",
  distance: "",
  skipped: false,
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatPlanned(
  planned?: Record<string, unknown> | null,
): string {
  if (!planned) {
    return "—";
  }
  const parts: string[] = [];
  const sets = asNumber(planned.sets);
  const reps = asNumber(planned.reps);

  if (sets != null && reps != null) {
    parts.push(`${sets}×${reps}`);
  } else if (reps != null) {
    parts.push(`${reps} повт.`);
  } else if (sets != null) {
    parts.push(`${sets} подх.`);
  }

  const weight = asNumber(planned.weight_kg);
  if (weight != null) {
    parts.push(`${weight} кг`);
  }
  const durationMin = asNumber(planned.duration_min);
  if (durationMin != null) {
    parts.push(`${durationMin} мин`);
  }
  const durationSec = asNumber(planned.duration_sec);
  if (durationSec != null) {
    parts.push(`${durationSec} с`);
  }
  const distance = asNumber(planned.distance_m);
  if (distance != null) {
    parts.push(`${distance} м`);
  }

  return parts.length ? parts.join(" · ") : "—";
}

export function plannedSetCount(
  planned?: Record<string, unknown> | null,
): number {
  const sets = asNumber(planned?.sets);
  if (sets && sets > 0 && sets <= 20) {
    return Math.floor(sets);
  }
  return 3;
}

export function createSetDrafts(count: number): SetDraft[] {
  return Array.from({ length: Math.max(1, count) }, () => ({
    ...EMPTY_SET_DRAFT,
  }));
}

export function setsToDrafts(sets: WorkoutSet[]): SetDraft[] {
  if (!sets.length) {
    return [];
  }
  return sets.map((set) => ({
    reps: set.skipped || set.reps == null ? "" : String(set.reps),
    weight:
      set.skipped || set.weight_kg == null ? "" : String(set.weight_kg),
    duration:
      set.skipped || set.duration_sec == null
        ? ""
        : String(set.duration_sec),
    distance:
      set.skipped || set.distance_m == null ? "" : String(set.distance_m),
    skipped: set.skipped,
  }));
}

export function parseDraftNumber(raw: string): number | null | "invalid" {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : "invalid";
}

export function validateSetDraft(draft: SetDraft): string | null {
  if (draft.skipped) {
    return null;
  }

  const reps = parseDraftNumber(draft.reps);
  const weight = parseDraftNumber(draft.weight);
  const duration = parseDraftNumber(draft.duration);
  const distance = parseDraftNumber(draft.distance);

  if (
    reps === "invalid" ||
    weight === "invalid" ||
    duration === "invalid" ||
    distance === "invalid"
  ) {
    return "Проверьте числовые значения.";
  }

  if (reps != null) {
    if (!Number.isInteger(reps) || reps < 0 || reps > 1000) {
      return "Повторения — целое число от 0 до 1000.";
    }
  }
  if (weight != null && (weight <= 0 || weight > 500)) {
    return "Вес — больше 0 и не больше 500 кг.";
  }
  if (duration != null) {
    if (!Number.isInteger(duration) || duration < 1 || duration > 86400) {
      return "Длительность — целое число секунд от 1 до 86400.";
    }
  }
  if (distance != null && (distance <= 0 || distance > 100000)) {
    return "Дистанция — больше 0 и не больше 100000 м.";
  }
  if (reps == null && duration == null && distance == null) {
    return "Укажите повторения, длительность или дистанцию.";
  }
  return null;
}

export function draftToPayload(draft: SetDraft): WorkoutSetPayload {
  if (draft.skipped) {
    return { skipped: true };
  }
  const reps = parseDraftNumber(draft.reps);
  const weight = parseDraftNumber(draft.weight);
  const duration = parseDraftNumber(draft.duration);
  const distance = parseDraftNumber(draft.distance);
  return {
    reps: reps === "invalid" ? null : reps,
    weight_kg: weight === "invalid" ? null : weight,
    duration_sec: duration === "invalid" ? null : duration,
    distance_m: distance === "invalid" ? null : distance,
  };
}

export function columnsFor(
  planned?: Record<string, unknown> | null,
  drafts: SetDraft[] = [],
): SetColumns {
  const hasDraft = (
    key: "reps" | "weight" | "duration" | "distance",
  ): boolean => drafts.some((draft) => draft[key].trim() !== "");

  const reps = asNumber(planned?.reps) != null || hasDraft("reps");
  const weight =
    asNumber(planned?.weight_kg) != null ||
    asNumber(planned?.reps) != null ||
    hasDraft("weight");
  const duration =
    asNumber(planned?.duration_min) != null ||
    asNumber(planned?.duration_sec) != null ||
    hasDraft("duration");
  const distance =
    asNumber(planned?.distance_m) != null || hasDraft("distance");

  if (!reps && !weight && !duration && !distance) {
    return { reps: true, weight: true, duration: false, distance: false };
  }
  return { reps, weight, duration, distance };
}

export function totalVolume(
  setsByExercise: Array<{ sets: WorkoutSetPayload[] }>,
): number {
  let volume = 0;
  for (const exercise of setsByExercise) {
    for (const set of exercise.sets) {
      if (set.skipped) {
        continue;
      }
      const reps = set.reps ?? 0;
      const weight = set.weight_kg ?? 0;
      volume += reps * weight;
    }
  }
  return Math.round(volume * 10) / 10;
}

export function filledSetsCount(sets: SetDraft[]): number {
  return sets.filter(
    (draft) =>
      draft.skipped ||
      draft.reps.trim() !== "" ||
      draft.duration.trim() !== "" ||
      draft.distance.trim() !== "",
  ).length;
}
