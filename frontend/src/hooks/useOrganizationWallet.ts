import { useEffect, useState } from "react";
import { getOrganizationWallet } from "../services/organizations";
import { subscribeToWalletChanges } from "../utils/walletEvents";

export const WALLET_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

export type WalletStatus = (typeof WALLET_STATUS)[keyof typeof WALLET_STATUS];

interface Fetched {
  organizationId: number;
  balance: string | null;
}

/**
 * Balance of one organization's wallet. Refetches on every wallet event
 * (OW-W7) and keeps the last balance visible while it does. State is tagged
 * with the organization it belongs to, so a value fetched for another
 * organization is never exposed and a late response is dropped by the effect
 * cleanup (OW-WS16). `null` means personal mode: no request is issued.
 */
export function useOrganizationWallet(organizationId: number | null) {
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => subscribeToWalletChanges(() => setRefreshCount((count) => count + 1)), []);

  useEffect(() => {
    if (organizationId === null) return;
    let cancelled = false;
    const settle = (balance: string | null) => {
      if (!cancelled) setFetched({ organizationId, balance });
    };

    getOrganizationWallet(organizationId)
      .then((response) => settle(response.data.balance))
      .catch(() => settle(null));

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshCount]);

  const current = organizationId !== null && fetched?.organizationId === organizationId ? fetched : null;
  const status: WalletStatus =
    organizationId === null
      ? WALLET_STATUS.IDLE
      : current === null
        ? WALLET_STATUS.LOADING
        : current.balance === null
          ? WALLET_STATUS.ERROR
          : WALLET_STATUS.READY;

  return { status, balance: current?.balance ?? null };
}
