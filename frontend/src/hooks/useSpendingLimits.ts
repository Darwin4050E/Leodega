import { useCallback, useEffect, useState } from "react";
import { getSpendingLimits, type SpendingLimitRow } from "../services/organizations";
import { subscribeToWalletChanges } from "../utils/walletEvents";

export const SPENDING_LIMITS_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

export type SpendingLimitsStatus = (typeof SPENDING_LIMITS_STATUS)[keyof typeof SPENDING_LIMITS_STATUS];

interface Fetched {
  organizationId: number;
  rows: SpendingLimitRow[] | null;
}

/**
 * Member limits and month usage of one organization. Same shape as
 * `useOrganizationWallet`: state is tagged with its organization and a late
 * response is dropped by the effect cleanup (ML-WS18). It refetches on every
 * wallet event because a booking, cancellation or top-up changes the consumed
 * amount (ML-WS19), and on `refresh()` after a limit is saved. `null` means
 * personal mode: no request is issued.
 */
export function useSpendingLimits(organizationId: number | null) {
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  useEffect(() => subscribeToWalletChanges(refresh), [refresh]);

  useEffect(() => {
    if (organizationId === null) return;
    let cancelled = false;
    const settle = (rows: SpendingLimitRow[] | null) => {
      if (!cancelled) setFetched({ organizationId, rows });
    };

    getSpendingLimits(organizationId)
      .then((response) => settle(response.data))
      .catch(() => settle(null));

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshCount]);

  const current = organizationId !== null && fetched?.organizationId === organizationId ? fetched : null;
  const status: SpendingLimitsStatus =
    organizationId === null
      ? SPENDING_LIMITS_STATUS.IDLE
      : current === null
        ? SPENDING_LIMITS_STATUS.LOADING
        : current.rows === null
          ? SPENDING_LIMITS_STATUS.ERROR
          : SPENDING_LIMITS_STATUS.READY;

  return { status, rows: current?.rows ?? [], refresh };
}
