import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getOrganizations, type Organization } from '../services/organizations';
import {
  CONTEXT_KIND,
  activeContextKey,
  clearStoredOrganizationId,
  readStoredOrganizationId,
  subscribeToForcedPersonal,
  writeStoredOrganizationId,
} from '../utils/activeContext';
import {
  ActiveContext,
  ORGANIZATIONS_STATUS,
  type ActiveContextSelection,
  type OrganizationsStatus,
} from './activeContextBase';
import { useAuth } from './useAuth';

interface FetchedOrganizations {
  key: string;
  status: typeof ORGANIZATIONS_STATUS.READY | typeof ORGANIZATIONS_STATUS.ERROR;
  organizations: Organization[];
}

const NO_ORGANIZATIONS: Organization[] = [];

export function ActiveContextProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const enabled = token !== null && user?.role === 'tenant';
  const ownerId = enabled && user ? user.id : null;

  const [trackedOwnerId, setTrackedOwnerId] = useState(ownerId);
  const [storedId, setStoredId] = useState<number | null>(() =>
    ownerId === null ? null : readStoredOrganizationId(ownerId),
  );
  const [added, setAdded] = useState<Organization[]>([]);
  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<FetchedOrganizations | null>(null);

  if (trackedOwnerId !== ownerId) {
    setTrackedOwnerId(ownerId);
    setStoredId(ownerId === null ? null : readStoredOrganizationId(ownerId));
    setAdded([]);
  }

  const activatedIds = useRef(new Set<number>());
  const fetchKey = `${ownerId}:${reloadCount}`;

  useEffect(() => {
    activatedIds.current.clear();
  }, [ownerId]);

  useEffect(() => {
    if (ownerId === null) return;
    const syncFromStorage = () => setStoredId(readStoredOrganizationId(ownerId));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === activeContextKey(ownerId)) syncFromStorage();
    };
    window.addEventListener('storage', onStorage);
    const unsubscribe = subscribeToForcedPersonal(syncFromStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      unsubscribe();
    };
  }, [ownerId]);

  useEffect(() => {
    if (ownerId === null) return;
    let cancelled = false;
    const finish = (status: FetchedOrganizations['status'], organizations: Organization[]) => {
      if (!cancelled) setFetched({ key: fetchKey, status, organizations });
    };

    getOrganizations()
      .then((response) => {
        if (!Array.isArray(response.data)) {
          finish(ORGANIZATIONS_STATUS.ERROR, NO_ORGANIZATIONS);
          return;
        }
        const list = response.data;
        const current = readStoredOrganizationId(ownerId);
        const missing =
          current !== null &&
          !list.some((item) => item.id === current) &&
          !activatedIds.current.has(current);
        if (!cancelled && missing) {
          clearStoredOrganizationId(ownerId);
          setStoredId(null);
        }
        finish(ORGANIZATIONS_STATUS.READY, list);
      })
      .catch(() => finish(ORGANIZATIONS_STATUS.ERROR, NO_ORGANIZATIONS));

    return () => {
      cancelled = true;
    };
  }, [ownerId, fetchKey]);

  const current = fetched?.key === fetchKey ? fetched : null;
  const status: OrganizationsStatus = !enabled
    ? ORGANIZATIONS_STATUS.IDLE
    : (current?.status ?? ORGANIZATIONS_STATUS.LOADING);
  const fetchedList = current?.status === ORGANIZATIONS_STATUS.READY ? current.organizations : [];
  const organizations = [...fetchedList, ...added.filter((item) => !fetchedList.some((f) => f.id === item.id))];

  const context: ActiveContextSelection =
    storedId === null
      ? { kind: CONTEXT_KIND.PERSONAL }
      : { kind: CONTEXT_KIND.ORGANIZATION, organizationId: storedId };
  const activeOrganization =
    storedId === null ? null : (organizations.find((item) => item.id === storedId) ?? null);

  const selectOrganization = (organizationId: number) => {
    if (ownerId === null) return;
    writeStoredOrganizationId(ownerId, organizationId);
    setStoredId(organizationId);
  };

  const selectPersonal = () => {
    if (ownerId === null) return;
    clearStoredOrganizationId(ownerId);
    setStoredId(null);
  };

  const activateOrganization = (organization: Organization) => {
    activatedIds.current.add(organization.id);
    setAdded((previous) => [...previous.filter((item) => item.id !== organization.id), organization]);
    selectOrganization(organization.id);
  };

  const reloadOrganizations = () => setReloadCount((count) => count + 1);

  return (
    <ActiveContext.Provider
      value={{
        context,
        activeOrganization,
        organizations,
        status,
        enabled,
        selectOrganization,
        selectPersonal,
        activateOrganization,
        reloadOrganizations,
      }}
    >
      {children}
    </ActiveContext.Provider>
  );
}
