import { useEffect, useState } from "react";
import { asApiError } from "../api/errors";
import {
  getPanelHistory,
  getPanelMembers,
  getPanelReservations,
  getPanelSummary,
  type PaginatedPanelHistory,
  type PaginatedPanelReservations,
  type PanelMember,
  type PanelSummary,
} from "../services/organizations";

export const PANEL_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  /** The server refused the caller (not a member, or not an admin for history). */
  FORBIDDEN: "forbidden",
} as const;

export type PanelStatus = (typeof PANEL_STATUS)[keyof typeof PANEL_STATUS];

type Loader<T> = (organizationId: number, page: number) => Promise<{ data: T }>;

// What one fetch settled to, tagged with the request it answered so an answer
// for another organization, page or attempt is never shown as the current one.
interface Settled<T> {
  organizationId: number;
  page: number;
  attempt: number;
  status: typeof PANEL_STATUS.READY | typeof PANEL_STATUS.ERROR | typeof PANEL_STATUS.FORBIDDEN;
  data: T | null;
  message: string | null;
}

// Module-level so the effect dependency stays stable; the endpoints that are
// not paged ignore the page.
const loadSummary: Loader<PanelSummary> = (organizationId) => getPanelSummary(organizationId);
const loadMembers: Loader<PanelMember[]> = (organizationId) => getPanelMembers(organizationId);
const loadReservations: Loader<PaginatedPanelReservations> = (organizationId, page) =>
  getPanelReservations(organizationId, page);
const loadHistory: Loader<PaginatedPanelHistory> = (organizationId, page) => getPanelHistory(organizationId, page);

/**
 * Shared core of the four panel sections. `null` means "do not load" (personal
 * mode, or a section the caller may not see): no request is issued. A late
 * response is dropped by the effect cleanup (WS11, WS12) and the settled state
 * is tagged with its request, so switching organization or page shows loading
 * instead of stale data (WS10). `reload` retries only this section (WS61).
 *
 * `message` is set only for a 403, carrying the server text verbatim; any
 * other failure leaves it null so the section renders its own generic copy
 * and never framework or SQL text (WS60).
 */
function usePanelResource<T>(organizationId: number | null, page: number, load: Loader<T>) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (organizationId === null) return;
    let ignore = false;

    load(organizationId, page)
      .then((response) => {
        if (ignore) return;
        setSettled({ organizationId, page, attempt, status: PANEL_STATUS.READY, data: response.data, message: null });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        const response = asApiError(error).response;
        const forbidden = response?.status === 403;
        setSettled({
          organizationId,
          page,
          attempt,
          status: forbidden ? PANEL_STATUS.FORBIDDEN : PANEL_STATUS.ERROR,
          data: null,
          message: forbidden ? (response?.data?.message ?? null) : null,
        });
      });

    return () => {
      ignore = true;
    };
  }, [organizationId, page, attempt, load]);

  const current =
    organizationId !== null &&
    settled?.organizationId === organizationId &&
    settled.page === page &&
    settled.attempt === attempt
      ? settled
      : null;
  const status: PanelStatus =
    organizationId === null ? PANEL_STATUS.IDLE : (current?.status ?? PANEL_STATUS.LOADING);

  return {
    status,
    data: current?.data ?? null,
    message: current?.message ?? null,
    reload: () => setAttempt((count) => count + 1),
  };
}

export function usePanelSummary(organizationId: number | null) {
  return usePanelResource(organizationId, 1, loadSummary);
}

export function usePanelMembers(organizationId: number | null) {
  return usePanelResource(organizationId, 1, loadMembers);
}

/** Active reservations; the page lives here and returns to 1 on an organization switch (WS10). */
export function usePanelReservations(organizationId: number | null) {
  const [trackedOrganizationId, setTrackedOrganizationId] = useState(organizationId);
  const [page, setPage] = useState(1);

  if (trackedOrganizationId !== organizationId) {
    setTrackedOrganizationId(organizationId);
    setPage(1);
  }

  const resource = usePanelResource(organizationId, page, loadReservations);

  return { ...resource, page, goToPage: (nextPage: number) => setPage(nextPage) };
}

/** Admin-only feed: pass `enabled` false for a member and no request is issued. */
export function usePanelHistory(organizationId: number | null, enabled: boolean, page: number) {
  return usePanelResource(enabled ? organizationId : null, page, loadHistory);
}
