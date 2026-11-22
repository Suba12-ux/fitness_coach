import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";

export type SystemState = "loading" | "ok" | "degraded" | "offline";

export interface SystemStatus {
  state: SystemState;
  checks: Record<string, string>;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 30_000;

export function useSystemStatus(): SystemStatus {
  const [state, setState] = useState<SystemState>("loading");
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api.ready();
        if (cancelled) {
          return;
        }
        setChecks(data.checks ?? {});
        setState(data.status === "ok" ? "ok" : "degraded");
      } catch {
        if (cancelled) {
          return;
        }
        setChecks({});
        setState("offline");
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [version]);

  return { state, checks, refresh };
}
