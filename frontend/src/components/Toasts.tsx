import type { ToastItem } from "../hooks/useToasts";
import { IconAlert, IconCheck, IconClose, IconInfo } from "./Icons";

interface ToastsProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const ICONS = {
  success: IconCheck,
  error: IconAlert,
  info: IconInfo,
};

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon />
            <div className="toast__body">{toast.message}</div>
            <button
              type="button"
              className="toast__close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Закрыть уведомление"
            >
              <IconClose width={14} height={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
