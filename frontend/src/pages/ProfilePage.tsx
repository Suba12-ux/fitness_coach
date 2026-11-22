import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError, api } from "../api/client";
import type { ToastTone } from "../hooks/useToasts";
import {
  EMPTY_PROFILE_FIELDS,
  profileFieldsFromProfile,
  profilePayloadFromFields,
  validateProfileFields,
  type ProfileFieldsValues,
} from "../lib/profileForm";
import { ProfileFields } from "../components/ProfileFields";

interface ProfilePageProps {
  notify: (message: string, tone?: ToastTone) => void;
}

export function ProfilePage({ notify }: ProfilePageProps) {
  const [values, setValues] = useState<ProfileFieldsValues>(
    EMPTY_PROFILE_FIELDS,
  );
  const [persisted, setPersisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const errors = useMemo(
    () => (attempted ? validateProfileFields(values) : {}),
    [attempted, values],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    api
      .getProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }
        setValues(profileFieldsFromProfile(profile));
        setPersisted(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setValues(EMPTY_PROFILE_FIELDS);
          setPersisted(false);
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить профиль.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleChange = (patch: Partial<ProfileFieldsValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (Object.keys(validateProfileFields(values)).length > 0) {
      notify("Проверьте выделенные поля профиля.", "error");
      return;
    }

    setSaving(true);
    try {
      const saved = await api.putProfile(profilePayloadFromFields(values));
      setValues(profileFieldsFromProfile(saved));
      setPersisted(true);
      setAttempted(false);
      notify("Профиль сохранён.", "success");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить профиль.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            Постоянный профиль
          </span>
          <h1>Ваш профиль</h1>
          <p>
            Сохранённые данные подставляются в форму нового плана. Изменения
            здесь не запускают генерацию.
          </p>
        </div>
        <span
          className={`status status--${persisted ? "success" : "neutral"}`}
        >
          <span className="status__dot" />
          {persisted ? "Профиль сохранён" : "Профиль не заполнен"}
        </span>
      </header>

      {loading ? (
        <div className="card" aria-busy="true" aria-label="Загрузка профиля">
          <span className="skeleton" style={{ width: "45%", height: 18 }} />
          <span
            className="skeleton"
            style={{ width: "80%", height: 12, marginTop: 16 }}
          />
          <span
            className="skeleton"
            style={{ width: "60%", height: 12, marginTop: 10 }}
          />
        </div>
      ) : loadError ? (
        <div className="card notice-card notice-card--danger">
          <h2>Не удалось загрузить профиль</h2>
          <p>{loadError}</p>
          <div className="notice-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Повторить
            </button>
          </div>
        </div>
      ) : (
        <form
          className="card profile-card"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="card__head">
            <div>
              <h2>Данные профиля</h2>
              <p>Их используют агенты при построении нагрузки.</p>
            </div>
          </div>

          {!persisted ? (
            <div className="notice-inline notice-inline--info" role="status">
              <div>
                Профиль ещё не сохранён. Заполните данные и нажмите
                «Сохранить профиль».
              </div>
            </div>
          ) : null}

          <ProfileFields
            values={values}
            errors={errors}
            onChange={handleChange}
            disabled={saving}
          />

          <div className="form-actions">
            <span className="form-note">
              Профиль хранится в вашем аккаунте и доступен только вам.
            </span>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : null}
              Сохранить профиль
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
