import { useState, type FormEvent } from "react";

import type { SystemStatus } from "../hooks/useSystemStatus";
import { FORM_EXAMPLES, GOAL_SUGGESTIONS, type FormExample } from "../lib/examples";
import {
  MAX_REQUEST_LENGTH,
  type FormErrors,
  type FormState,
} from "../lib/validation";
import {
  IconAlert,
  IconArrowRight,
  IconClose,
  IconLightbulb,
  IconPlus,
  IconShield,
  IconTarget,
} from "./Icons";

interface ComposerProps {
  form: FormState;
  errors: FormErrors;
  busy: boolean;
  launchError: string | null;
  system: SystemStatus;
  onChange: (patch: Partial<FormState>) => void;
  onExample: (example: FormExample) => void;
  onSubmit: () => void;
}

interface StepperProps {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  errorId?: string;
  onChange: (value: number) => void;
}

function Stepper({
  id,
  value,
  min,
  max,
  step = 1,
  unit,
  errorId,
  onChange,
}: StepperProps) {
  return (
    <div
      className="stepper"
      id={id}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={errorId}
      aria-invalid={errorId ? true : undefined}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={`Уменьшить: ${unit}`}
      >
        −
      </button>
      <span className="stepper__value" aria-live="polite">
        {value}
        <span className="stepper__unit">{unit}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={`Увеличить: ${unit}`}
      >
        +
      </button>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <span className="field__error" id={id} role="alert">
      {message}
    </span>
  );
}

export function Composer({
  form,
  errors,
  busy,
  launchError,
  system,
  onChange,
  onExample,
  onSubmit,
}: ComposerProps) {
  const [draftLimitation, setDraftLimitation] = useState("");

  const addLimitation = () => {
    const value = draftLimitation.trim().replace(/,$/, "");
    if (!value) {
      return;
    }
    if (!form.limitations.some((item) => item === value)) {
      onChange({ limitations: [...form.limitations, value] });
    }
    setDraftLimitation("");
  };

  const removeLimitation = (value: string) => {
    onChange({
      limitations: form.limitations.filter((item) => item !== value),
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    addLimitation();
    onSubmit();
  };

  const queueDown =
    system.state !== "loading" && system.checks.redis !== "ok";
  const apiOffline = system.state === "offline";

  return (
    <>
      <section className="hero">
        <span className="eyebrow">
          <span className="eyebrow__dot" />
          Мультиагентный планировщик
        </span>
        <h1>
          План тренировок,
          <br />
          <em>собранный агентами</em>
        </h1>
        <p>
          Опишите цель — Supervisor распределит работу между профилем,
          тренировочным агентом и проверкой безопасности, а затем соберёт
          готовый недельный план.
        </p>
      </section>

      <form className="compose-grid" onSubmit={handleSubmit} noValidate>
        <div className="card">
          <div className="card__head">
            <div>
              <h2>Запрос</h2>
              <p>Чем точнее формулировка, тем полезнее план.</p>
            </div>
            <span className="pill">Шаг 1 из 2</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="request">
              Что нужно подготовить?
            </label>
            <div className="request-box">
              <textarea
                id="request"
                className="textarea"
                placeholder="Например: подготовьте план для новичка на 3 тренировки в неделю по 45 минут, без специального оборудования."
                value={form.request}
                maxLength={MAX_REQUEST_LENGTH}
                onChange={(event) => onChange({ request: event.target.value })}
                aria-invalid={Boolean(errors.request)}
                aria-describedby={errors.request ? "request-error" : undefined}
              />
              <span className="request-counter">
                {form.request.length}/{MAX_REQUEST_LENGTH}
              </span>
            </div>
            <FieldError id="request-error" message={errors.request} />
          </div>

          <div className="examples">
            <span className="examples__label">Примеры:</span>
            {FORM_EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                className="chip"
                onClick={() => onExample(example)}
                disabled={busy}
              >
                {example.label}
              </button>
            ))}
          </div>

          <div className="divider" />

          <div className="card__head">
            <div>
              <h2>Профиль</h2>
              <p>Эти данные агенты используют для расчёта нагрузки.</p>
            </div>
            <span className="pill">Шаг 2 из 2</span>
          </div>

          <div className="form-grid">
            <div className="field field--wide">
              <label className="field__label" htmlFor="goal">
                Цель тренировок
              </label>
              <input
                id="goal"
                className="input"
                list="goal-suggestions"
                placeholder="Например: общая физическая форма"
                value={form.goal}
                onChange={(event) => onChange({ goal: event.target.value })}
                aria-invalid={Boolean(errors.goal)}
                aria-describedby={errors.goal ? "goal-error" : undefined}
              />
              <datalist id="goal-suggestions">
                {GOAL_SUGGESTIONS.map((goal) => (
                  <option key={goal} value={goal} />
                ))}
              </datalist>
              <FieldError id="goal-error" message={errors.goal} />
            </div>

            <div className="field field--wide">
              <span className="field__label" id="experience-label">
                Уровень подготовки
              </span>
              <div
                className="segmented"
                role="group"
                aria-labelledby="experience-label"
                aria-describedby={
                  errors.experience ? "experience-error" : undefined
                }
              >
                {[
                  { value: "beginner", label: "Новичок" },
                  { value: "intermediate", label: "Средний" },
                  { value: "advanced", label: "Продвинутый" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      form.experience === option.value ? "is-active" : ""
                    }
                    aria-pressed={form.experience === option.value}
                    onClick={() =>
                      onChange({
                        experience: option.value as FormState["experience"],
                      })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <FieldError id="experience-error" message={errors.experience} />
            </div>
          </div>

          <div className="form-grid form-grid--metrics">
            <div className="field">
              <label className="field__label" htmlFor="age">
                Возраст <span className="field__optional">необязательно</span>
              </label>
              <input
                id="age"
                className="input"
                inputMode="numeric"
                placeholder="30"
                value={form.age}
                onChange={(event) => onChange({ age: event.target.value })}
                aria-invalid={Boolean(errors.age)}
                aria-describedby={errors.age ? "age-error" : undefined}
              />
              <FieldError id="age-error" message={errors.age} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="weight">
                Вес, кг <span className="field__optional">необязательно</span>
              </label>
              <input
                id="weight"
                className="input"
                inputMode="numeric"
                placeholder="75"
                value={form.weight}
                onChange={(event) => onChange({ weight: event.target.value })}
                aria-invalid={Boolean(errors.weight)}
                aria-describedby={errors.weight ? "weight-error" : undefined}
              />
              <FieldError id="weight-error" message={errors.weight} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="height">
                Рост, см <span className="field__optional">необязательно</span>
              </label>
              <input
                id="height"
                className="input"
                inputMode="numeric"
                placeholder="178"
                value={form.height}
                onChange={(event) => onChange({ height: event.target.value })}
                aria-invalid={Boolean(errors.height)}
                aria-describedby={errors.height ? "height-error" : undefined}
              />
              <FieldError id="height-error" message={errors.height} />
            </div>
          </div>

          <div className="form-grid form-grid--schedule">
            <div className="field">
              <span className="field__label" id="days-label">
                Тренировок в неделю
              </span>
              <Stepper
                id="days"
                value={form.days}
                min={1}
                max={6}
                unit="дн."
                errorId={errors.days ? "days-error" : undefined}
                onChange={(value) => onChange({ days: value })}
              />
              <FieldError id="days-error" message={errors.days} />
            </div>
            <div className="field">
              <span className="field__label" id="minutes-label">
                Минут на занятие
              </span>
              <Stepper
                id="minutes"
                value={form.minutes}
                min={15}
                max={180}
                step={5}
                unit="мин"
                errorId={errors.minutes ? "minutes-error" : undefined}
                onChange={(value) => onChange({ minutes: value })}
              />
              <FieldError id="minutes-error" message={errors.minutes} />
            </div>
          </div>

          <div className="field form-limitations">
            <label className="field__label" htmlFor="limitations">
              Ограничения{" "}
              <span className="field__optional">если есть</span>
            </label>
            <div className="tag-input">
              {form.limitations.map((item) => (
                <span key={item} className="chip chip--tag">
                  {item}
                  <button
                    type="button"
                    className="chip__remove"
                    onClick={() => removeLimitation(item)}
                    aria-label={`Удалить ограничение «${item}»`}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </span>
              ))}
              <input
                id="limitations"
                placeholder={
                  form.limitations.length
                    ? "Добавить ещё…"
                    : "Например: боль в колене, запрет на бег"
                }
                value={draftLimitation}
                onChange={(event) => setDraftLimitation(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addLimitation();
                  } else if (
                    event.key === "Backspace" &&
                    !draftLimitation &&
                    form.limitations.length
                  ) {
                    removeLimitation(
                      form.limitations[form.limitations.length - 1],
                    );
                  }
                }}
                onBlur={addLimitation}
              />
              <button
                type="button"
                className="chip__remove"
                onClick={addLimitation}
                aria-label="Добавить ограничение"
              >
                <IconPlus width={13} height={13} />
              </button>
            </div>
            <span className="field__hint">
              Enter или запятая — добавить. Ограничения учитываются в плане и
              проверке безопасности.
            </span>
          </div>

          {apiOffline ? (
            <div className="notice-inline notice-inline--danger" role="status">
              <IconAlert />
              <div>
                <strong>API недоступен.</strong> Запустите backend, чтобы
                отправить запрос.
              </div>
            </div>
          ) : queueDown ? (
            <div className="notice-inline notice-inline--warning" role="status">
              <IconAlert />
              <div>
                <strong>Очередь задач недоступна.</strong> Запуск вернёт 503 —
                проверьте Redis и Worker.
              </div>
            </div>
          ) : null}

          {launchError ? (
            <div className="error-text" role="alert">
              {launchError}
            </div>
          ) : null}

          <div className="form-actions">
            <span className="form-note">
              <IconShield />
              Запрос обрабатывается вашим backend и LLM-провайдером из
              конфигурации проекта.
            </span>
            <button
              type="submit"
              className="btn btn--primary btn--lg"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Отправляю…
                </>
              ) : (
                <>
                  Создать план
                  <IconArrowRight />
                </>
              )}
            </button>
          </div>
        </div>

        <aside className="compose-aside">
          <section className="card pipeline-card">
            <h3>Как это работает</h3>
            <p>Четыре шага от запроса до готового плана.</p>
            <ol className="pipeline">
              <li className="pipeline__step">
                <span className="pipeline__num">01</span>
                <span className="pipeline__body">
                  <strong>Supervisor</strong>
                  <span>строит план задач и проверяет зависимости</span>
                </span>
              </li>
              <li className="pipeline__step">
                <span className="pipeline__num">02</span>
                <span className="pipeline__body">
                  <strong>ProfileAgent</strong>
                  <span>нормализует профиль и находит пробелы</span>
                </span>
              </li>
              <li className="pipeline__step">
                <span className="pipeline__num">03</span>
                <span className="pipeline__body">
                  <strong>Training + Safety</strong>
                  <span>собирают план и проверяют нагрузку параллельно</span>
                </span>
              </li>
              <li className="pipeline__step">
                <span className="pipeline__num">04</span>
                <span className="pipeline__body">
                  <strong>Сборка ответа</strong>
                  <span>валидация схемы и объединение результатов</span>
                </span>
              </li>
            </ol>
          </section>

          <section className="card tip-card">
            <span className="tip-card__head">
              <IconLightbulb />
              Совет
            </span>
            <p>
              Чем больше деталей в профиле, тем меньше предположений будет
              строить TrainingAgent. Возраст, вес и рост — необязательны, но
              помогают точнее подобрать нагрузку.
            </p>
          </section>

          <section className="card tip-card tip-card--plain">
            <span className="tip-card__head tip-card__head--muted">
              <IconTarget />
              Хороший запрос
            </span>
            <ul className="bullet-list">
              <li>Укажите цель и желаемую частоту занятий.</li>
              <li>Опишите ограничения и доступный инвентарь.</li>
              <li>Добавьте срок, если готовитесь к событию.</li>
            </ul>
          </section>
        </aside>
      </form>
    </>
  );
}
