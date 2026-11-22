import { useState } from "react";

import { GOAL_SUGGESTIONS } from "../lib/examples";
import type {
  ProfileFieldsErrors,
  ProfileFieldsValues,
} from "../lib/profileForm";
import { IconClose, IconPlus } from "./Icons";

interface ProfileFieldsProps {
  values: ProfileFieldsValues;
  errors: ProfileFieldsErrors;
  onChange: (patch: Partial<ProfileFieldsValues>) => void;
  disabled?: boolean;
}

interface StepperProps {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  errorId?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function Stepper({
  id,
  value,
  min,
  max,
  step = 1,
  unit,
  errorId,
  disabled,
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
        disabled={disabled || value <= min}
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
        disabled={disabled || value >= max}
        aria-label={`Увеличить: ${unit}`}
      >
        +
      </button>
    </div>
  );
}

export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }
  return (
    <span className="field__error" id={id} role="alert">
      {message}
    </span>
  );
}

export function ProfileFields({
  values,
  errors,
  onChange,
  disabled,
}: ProfileFieldsProps) {
  const [draftLimitation, setDraftLimitation] = useState("");

  const addLimitation = () => {
    const value = draftLimitation.trim().replace(/,$/, "");
    if (!value) {
      return;
    }
    if (!values.limitations.some((item) => item === value)) {
      onChange({ limitations: [...values.limitations, value] });
    }
    setDraftLimitation("");
  };

  const removeLimitation = (value: string) => {
    onChange({
      limitations: values.limitations.filter((item) => item !== value),
    });
  };

  return (
    <>
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
            value={values.goal}
            disabled={disabled}
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
                disabled={disabled}
                className={
                  values.experience === option.value ? "is-active" : ""
                }
                aria-pressed={values.experience === option.value}
                onClick={() =>
                  onChange({
                    experience:
                      option.value as ProfileFieldsValues["experience"],
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
            value={values.age}
            disabled={disabled}
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
            value={values.weight}
            disabled={disabled}
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
            value={values.height}
            disabled={disabled}
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
            value={values.days}
            min={1}
            max={6}
            disabled={disabled}
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
            value={values.minutes}
            min={15}
            max={180}
            step={5}
            disabled={disabled}
            unit="мин"
            errorId={errors.minutes ? "minutes-error" : undefined}
            onChange={(value) => onChange({ minutes: value })}
          />
          <FieldError id="minutes-error" message={errors.minutes} />
        </div>
      </div>

      <div className="field form-limitations">
        <label className="field__label" htmlFor="limitations">
          Ограничения <span className="field__optional">если есть</span>
        </label>
        <div className="tag-input">
          {values.limitations.map((item) => (
            <span key={item} className="chip chip--tag">
              {item}
              <button
                type="button"
                className="chip__remove"
                disabled={disabled}
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
              values.limitations.length
                ? "Добавить ещё…"
                : "Например: боль в колене, запрет на бег"
            }
            value={draftLimitation}
            disabled={disabled}
            onChange={(event) => setDraftLimitation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addLimitation();
              } else if (
                event.key === "Backspace" &&
                !draftLimitation &&
                values.limitations.length
              ) {
                removeLimitation(
                  values.limitations[values.limitations.length - 1],
                );
              }
            }}
            onBlur={addLimitation}
          />
          <button
            type="button"
            className="chip__remove"
            disabled={disabled}
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
    </>
  );
}
