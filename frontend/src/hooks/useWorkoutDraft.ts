const PREFIX = "sensei:workout-draft:";

function storageKey(workoutId: string): string {
  return `${PREFIX}${workoutId}`;
}

export function readWorkoutDraft<T>(workoutId: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(workoutId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeWorkoutDraft<T>(workoutId: string, data: T): void {
  try {
    window.sessionStorage.setItem(storageKey(workoutId), JSON.stringify(data));
  } catch {
    // Приватный режим или переполнение хранилища — черновик просто не сохранится.
  }
}

export function clearWorkoutDraft(workoutId: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(workoutId));
  } catch {
    // Нечего очищать.
  }
}
