import { EMPTY_FORM, type FormState } from "./validation";

export interface FormExample {
  id: string;
  label: string;
  form: FormState;
}

function example(patch: Partial<FormState>): FormState {
  return { ...EMPTY_FORM, ...patch };
}

export const FORM_EXAMPLES: FormExample[] = [
  {
    id: "start",
    label: "Старт с нуля",
    form: example({
      request:
        "Хочу начать тренироваться с нуля: 3 занятия в неделю по 45 минут, без специального оборудования.",
      goal: "общая физическая форма",
      age: "30",
      weight: "75",
      height: "178",
      experience: "beginner",
      days: 3,
      minutes: 45,
    }),
  },
  {
    id: "weight",
    label: "Снижение веса",
    form: example({
      request:
        "Помогите составить план для снижения веса: силовые и кардио, 4 тренировки по 50 минут.",
      goal: "снижение веса",
      age: "34",
      weight: "84",
      height: "171",
      experience: "intermediate",
      days: 4,
      minutes: 50,
      limitations: ["ноющая боль в колене"],
    }),
  },
  {
    id: "strength",
    label: "Развитие силы",
    form: example({
      request:
        "Нужен силовой блок на 5 тренировок в неделю по 60 минут: базовые движения и прогрессия нагрузки.",
      goal: "развитие силы",
      age: "28",
      weight: "88",
      height: "183",
      experience: "advanced",
      days: 5,
      minutes: 60,
    }),
  },
  {
    id: "marathon",
    label: "Полумарафон",
    form: example({
      request:
        "Готовлюсь к первому полумарафону через 3 месяца. Нужен план на 4 тренировки в неделю по 60 минут.",
      goal: "подготовка к марафону",
      age: "31",
      weight: "68",
      height: "174",
      experience: "intermediate",
      days: 4,
      minutes: 60,
    }),
  },
];

export const GOAL_SUGGESTIONS = [
  "общая физическая форма",
  "снижение веса",
  "развитие силы",
  "развитие выносливости",
  "подготовка к марафону",
  "восстановление после травмы",
];
