import { useEffect, useRef } from "react";

import { api } from "../api/client";
import type { WorkflowResponse } from "../api/types";
import { isTerminal } from "../lib/status";

const INITIAL_DELAY_MS = 900;
const MAX_DELAY_MS = 5000;

export function useRunPolling(
  runId: string | null,
  onUpdate: (run: WorkflowResponse) => void,
): void {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!runId) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let delay = INITIAL_DELAY_MS;

    const tick = async () => {
      try {
        const run = await api.getWorkflow(runId);
        if (cancelled) {
          return;
        }
        onUpdateRef.current(run);
        if (isTerminal(run.status)) {
          return;
        }
        delay = Math.min(MAX_DELAY_MS, Math.round(delay * 1.15));
      } catch {
        if (cancelled) {
          return;
        }
        delay = Math.min(MAX_DELAY_MS, Math.round(delay * 1.6));
      }
      timer = window.setTimeout(() => void tick(), delay);
    };

    timer = window.setTimeout(() => void tick(), INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [runId]);
}
