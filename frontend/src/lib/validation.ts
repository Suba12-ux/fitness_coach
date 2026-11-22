import type { ExperienceLevel, WorkflowPayload } from "../api/types";

export interface FormState {
  request: string;
  goal: string;
  age: string;
  weight: string;
  height: string;
  experience: ExperienceLevel | "";
  days: number;
  minutes: number;
  limitations: string[];
}

export type FormErrors = Partial<Record<keyof FormState, string>>;

export const MAX_REQUEST_LENGTH = 500;

export const EMPTY_FORM: FormState = {
  request: "",
  goal: "",
  age: "",
  weight: "",
  height: "",
  experience: "beginner",
  days: 3,
  minutes: 45,
  limitations: [],
};

const INTEGER_PATTERN = /^\d+$/;

function parseOptionalNumber(
  raw: string,
  label: string,
  min: number,
  max: number,
  errors: FormErrors,
  field: "age" | "weight" | "height",
): void {
  const value = raw.trim();
  if (!value) {
    return;
  }
  if (!INTEGER_PATTERN.test(value)) {
    errors[field] = `${label} должен быть целым числом.`;
    return;
  }
  const number = Number(value);
  if (number < min || number > max) {
    errors[field] = `${label} — от ${min} до ${max}.`;
  }
}

export function isFormPristine(form: FormState): boolean {
  return (
    form.request === "" &&
    form.goal === "" &&
    form.age === "" &&
    form.weight === "" &&
    form.height === "" &&
    form.experience === EMPTY_FORM.experience &&
    form.days === EMPTY_FORM.days &&
    form.minutes === EMPTY_FORM.minutes &&
    form.limitations.length === 0
  );
}

export function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const request = form.request.trim();

  if (!request) {
    errors.request = "Опишите, какой план вам нужен.";
  } else if (request.length < 5) {
    errors.request = "Добавьте чуть больше деталей к запросу.";
  }

  if (!form.goal.trim()) {
    errors.goal = "Укажите цель тренировок.";
  }
  if (!form.experience) {
    errors.experience = "Выберите уровень подготовки.";
  }

  parseOptionalNumber(form.age, "Возраст", 10, 100, errors, "age");
  parseOptionalNumber(form.weight, "Вес", 30, 300, errors, "weight");
  parseOptionalNumber(form.height, "Рост", 100, 250, errors, "height");

  if (!Number.isInteger(form.days) || form.days < 1 || form.days > 6) {
    errors.days = "Допустимо от 1 до 6 тренировок в неделю.";
  }
  if (
    !Number.isInteger(form.minutes) ||
    form.minutes < 15 ||
    form.minutes > 180
  ) {
    errors.minutes = "Длительность — от 15 до 180 минут.";
  }

  return errors;
}

export function buildPayload(form: FormState): WorkflowPayload {
  const limitations = [
    ...new Set(
      form.limitations.map((item) => item.trim()).filter(Boolean),
    ),
  ];

  const userData: Record<string, unknown> = {
    goal: form.goal.trim(),
    experience_level: form.experience || undefined,
    days_per_week: form.days,
    minutes_per_session: form.minutes,
  };

  const age = form.age.trim();
  const weight = form.weight.trim();
  const height = form.height.trim();
  if (age) {
    userData.age = Number(age);
  }
  if (weight) {
    userData.weight_kg = Number(weight);
  }
  if (height) {
    userData.height_cm = Number(height);
  }
  if (limitations.length) {
    userData.limitations = limitations;
  }

  return {
    request: form.request.trim(),
    user_data: userData,
  };
}

const EXPERIENCE_VALUES: ExperienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export function formFromUserData(
  request: string,
  data: Record<string, unknown> = {},
): FormState {
  const numberText = (value: unknown): string => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return typeof value === "string" ? value : "";
  };

  const experience =
    typeof data.experience_level === "string" &&
    EXPERIENCE_VALUES.includes(data.experience_level as ExperienceLevel)
      ? (data.experience_level as ExperienceLevel)
      : "beginner";

  const limitations = Array.isArray(data.limitations)
    ? data.limitations.filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  return {
    request,
    goal: typeof data.goal === "string" ? data.goal : "",
    age: numberText(data.age),
    weight: numberText(data.weight_kg),
    height: numberText(data.height_cm),
    experience,
    days:
      typeof data.days_per_week === "number" ? data.days_per_week : 3,
    minutes:
      typeof data.minutes_per_session === "number"
        ? data.minutes_per_session
        : 45,
    limitations,
  };
}
