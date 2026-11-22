import type { ExperienceLevel, Profile, ProfilePayload } from "../api/types";

export interface ProfileFieldsValues {
  goal: string;
  age: string;
  weight: string;
  height: string;
  experience: ExperienceLevel | "";
  days: number;
  minutes: number;
  limitations: string[];
}

export type ProfileFieldsErrors = Partial<
  Record<keyof ProfileFieldsValues, string>
>;

export const EMPTY_PROFILE_FIELDS: ProfileFieldsValues = {
  goal: "",
  age: "",
  weight: "",
  height: "",
  experience: "",
  days: 3,
  minutes: 45,
  limitations: [],
};

const EXPERIENCE_VALUES: ExperienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

const INTEGER_PATTERN = /^\d+$/;

function numberText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

function parseOptionalNumber(
  raw: string,
  label: string,
  min: number,
  max: number,
  errors: ProfileFieldsErrors,
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

export function validateProfileFields(
  values: ProfileFieldsValues,
): ProfileFieldsErrors {
  const errors: ProfileFieldsErrors = {};
  parseOptionalNumber(values.age, "Возраст", 10, 100, errors, "age");
  parseOptionalNumber(values.weight, "Вес", 30, 300, errors, "weight");
  parseOptionalNumber(values.height, "Рост", 100, 250, errors, "height");

  if (
    !Number.isInteger(values.days) ||
    values.days < 1 ||
    values.days > 6
  ) {
    errors.days = "Допустимо от 1 до 6 тренировок в неделю.";
  }
  if (
    !Number.isInteger(values.minutes) ||
    values.minutes < 15 ||
    values.minutes > 180
  ) {
    errors.minutes = "Длительность — от 15 до 180 минут.";
  }
  return errors;
}

export function profileFieldsFromProfile(
  profile: Profile,
): ProfileFieldsValues {
  const experience =
    profile.experience_level &&
    EXPERIENCE_VALUES.includes(profile.experience_level)
      ? profile.experience_level
      : "";

  return {
    goal: profile.goal ?? "",
    age: numberText(profile.age),
    weight: numberText(profile.weight_kg),
    height: numberText(profile.height_cm),
    experience,
    days: profile.days_per_week ?? 3,
    minutes: profile.minutes_per_session ?? 45,
    limitations: Array.isArray(profile.limitations)
      ? [...profile.limitations]
      : [],
  };
}

/** Перенести сохранённый профиль в форму, не затирая уже введённые значения. */
export function applyProfileToFields<T extends ProfileFieldsValues>(
  values: T,
  profile: Profile,
): T {
  return {
    ...values,
    goal: profile.goal ?? values.goal,
    age: profile.age != null ? String(profile.age) : values.age,
    weight:
      profile.weight_kg != null ? String(profile.weight_kg) : values.weight,
    height:
      profile.height_cm != null ? String(profile.height_cm) : values.height,
    experience: profile.experience_level ?? values.experience,
    days: profile.days_per_week ?? values.days,
    minutes: profile.minutes_per_session ?? values.minutes,
    limitations:
      profile.limitations?.length ? [...profile.limitations] : values.limitations,
  };
}

export function profilePayloadFromFields(
  values: ProfileFieldsValues,
): ProfilePayload {
  const limitations = [
    ...new Set(values.limitations.map((item) => item.trim()).filter(Boolean)),
  ];
  const age = values.age.trim();
  const weight = values.weight.trim();
  const height = values.height.trim();

  return {
    goal: values.goal.trim() || null,
    age: age ? Number(age) : null,
    weight_kg: weight ? Number(weight) : null,
    height_cm: height ? Number(height) : null,
    experience_level: values.experience || null,
    days_per_week: Number.isInteger(values.days) ? values.days : null,
    minutes_per_session: Number.isInteger(values.minutes)
      ? values.minutes
      : null,
    limitations,
  };
}

export function isProfileFieldsEmpty(values: ProfileFieldsValues): boolean {
  return (
    !values.goal.trim() &&
    !values.age.trim() &&
    !values.weight.trim() &&
    !values.height.trim() &&
    !values.experience &&
    values.limitations.length === 0
  );
}
