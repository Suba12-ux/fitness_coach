import { useEffect, useState } from "react";

import { parseApiDate } from "../lib/format";

export function useElapsed(startedAt?: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const start = parseApiDate(startedAt);
  if (!start) {
    return 0;
  }
  return Math.max(0, Math.floor((now - start.getTime()) / 1000));
}
