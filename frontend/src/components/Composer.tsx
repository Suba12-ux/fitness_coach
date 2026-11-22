import type { FormEvent } from "react";

import type { SystemStatus } from "../hooks/useSystemStatus";
import { FORM_EXAMPLES, type FormExample } from "../lib/examples";
import {
  MAX_REQUEST_LENGTH,
  type FormErrors,
  type FormState,
} from "../lib/validation";
import {
  IconAlert,
  IconArrowRight,
  IconLightbulb,
  IconShield,
  IconTarget,
} from "./Icons";
import { FieldError, ProfileFields } from "./ProfileFields";

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
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
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

          <ProfileFields
            values={form}
            errors={errors}
            onChange={onChange}
            disabled={busy}
          />

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
