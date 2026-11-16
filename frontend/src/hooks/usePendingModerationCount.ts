import { useEffect, useState } from "react";
import { getDashboardSummary } from "../services/dashboard";

/**
 * Number of storerooms waiting for moderation, read from the dashboard
 * summary. Only fetches when `enabled`; a failed request leaves the count
 * at 0 so callers can simply hide their badge.
 */
export function usePendingModerationCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getDashboardSummary()
      .then(({ data }) => {
        if (!cancelled) setCount(data.pending_moderation);
      })
      .catch(() => {
        // Badge is decorative: degrade silently.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return count;
}
