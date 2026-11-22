import { statusMeta } from "../lib/status";

interface StatusBadgeProps {
  status: string;
  busy?: boolean;
}

export function StatusBadge({ status, busy = false }: StatusBadgeProps) {
  const meta = statusMeta(status);
  return (
    <span className={`status status--${meta.tone}`} title={meta.hint}>
      {busy ? <span className="spinner" aria-hidden="true" /> : <span className="status__dot" />}
      {meta.label}
    </span>
  );
}
