import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { ToastTone } from "../hooks/useToasts";

interface SaveProgramDialogProps {
  open: boolean;
  runId: string;
  defaultName: string;
  onClose: () => void;
  onSaved: (programId: string) => void;
  notify: (message: string, tone?: ToastTone) => void;
}

export function SaveProgramDialog({
  open,
  runId,
  defaultName,
  onClose,
  onSaved,
  notify,
}: SaveProgramDialogProps) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
    }
  }, [open, defaultName]);

  if (!open) {
    return null;
  }

  const save = async () => {
    setSaving(true);
    try {
      const program = await api.createProgram({
        run_id: runId,
        name: name.trim() || undefined,
      });
      notify("Программа сохранена.", "success");
      onSaved(program.id);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить программу.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={() => {
        if (!saving) {
          onClose();
        }
      }}
    >
      <div
        className="account-dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-program-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="account-dialog__head">
          <h2 id="save-program-title">Сохранить как программу</h2>
        </div>
        <div className="account-dialog__body">
          <p className="muted" style={{ marginTop: 0 }}>
            Программа не зависит от запуска: план сохранится в базе и будет
            доступен после повторного входа.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="program-name">
              Название программы
            </label>
            <input
              id="program-name"
              className="input"
              value={name}
              maxLength={200}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="account-dialog__foot">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : null}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
