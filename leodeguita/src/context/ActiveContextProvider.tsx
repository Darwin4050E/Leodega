import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { listOrganizations, type Organization } from '../services/organizations'
import {
  ActiveContext,
  ORGANIZATIONS_STATUS,
  type OrganizationsStatus,
} from './activeContextBase'
import {
  activeContextKey,
  clearStoredOrganizationId,
  parseOrganizationId,
  readStoredOrganizationId,
  registerForcedPersonalHandler,
  writeStoredOrganizationId,
} from './activeContextStorage'

interface FetchResult {
  fetchKey: string
  organizations: Organization[]
  failed: boolean
}

const NO_ORGANIZATIONS: Organization[] = []

function readStoredFor(ownerId: number | null): number | null {
  return ownerId === null ? null : readStoredOrganizationId(ownerId)
}

/**
 * Holds the tenant's organizations and chosen context for the whole app. The
 * stored id in localStorage is the source of truth for the HTTP header (see
 * activeContextStorage.ts); this provider mirrors it into React state and
 * validates it against the list the backend returns.
 */
export function ActiveContextProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const enabled = Boolean(token) && user?.role === 'tenant'
  const ownerId = enabled && user ? user.id : null

  const [trackedOwnerId, setTrackedOwnerId] = useState(ownerId)
  const [storedId, setStoredId] = useState(() => readStoredFor(ownerId))
  const [result, setResult] = useState<FetchResult | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  if (trackedOwnerId !== ownerId) {
    setTrackedOwnerId(ownerId)
    setStoredId(readStoredFor(ownerId))
    setResult(null)
  }

  const fetchKey = ownerId === null ? null : `${ownerId}:${reloadCount}`

  useEffect(() => {
    if (ownerId === null || fetchKey === null) return
    let cancelled = false
    listOrganizations().then(
      (organizations) => {
        if (cancelled) return
        const current = readStoredFor(ownerId)
        if (current !== null && !organizations.some((org) => org.id === current)) {
          clearStoredOrganizationId(ownerId)
          setStoredId(null)
        }
        setResult({ fetchKey, organizations, failed: false })
      },
      () => {
        if (!cancelled) setResult({ fetchKey, organizations: NO_ORGANIZATIONS, failed: true })
      },
    )
    return () => {
      cancelled = true
    }
  }, [ownerId, fetchKey])

  useEffect(() => {
    if (ownerId === null) return
    return registerForcedPersonalHandler(() => setStoredId(readStoredOrganizationId(ownerId)))
  }, [ownerId])

  const reloadOrganizations = useCallback(() => {
    setReloadCount((count) => count + 1)
  }, [])

  const selectOrganization = useCallback(
    (organizationId: number) => {
      if (ownerId === null || organizationId === storedId) return
      writeStoredOrganizationId(ownerId, organizationId)
      setStoredId(organizationId)
    },
    [ownerId, storedId],
  )

  const selectPersonal = useCallback(() => {
    if (ownerId === null || storedId === null) return
    clearStoredOrganizationId(ownerId)
    setStoredId(null)
  }, [ownerId, storedId])

  let status: OrganizationsStatus = ORGANIZATIONS_STATUS.IDLE
  if (fetchKey !== null) {
    if (result?.fetchKey !== fetchKey) status = ORGANIZATIONS_STATUS.LOADING
    else status = result.failed ? ORGANIZATIONS_STATUS.ERROR : ORGANIZATIONS_STATUS.READY
  }
  const organizations = result && !result.failed ? result.organizations : NO_ORGANIZATIONS

  useEffect(() => {
    if (ownerId === null) return
    const key = activeContextKey(ownerId)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      const next = parseOrganizationId(event.newValue)
      const unknown =
        next !== null &&
        status === ORGANIZATIONS_STATUS.READY &&
        !organizations.some((org) => org.id === next)
      if (unknown) clearStoredOrganizationId(ownerId)
      setStoredId(unknown ? null : next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [ownerId, status, organizations])

  const activeOrganization =
    storedId === null ? null : (organizations.find((org) => org.id === storedId) ?? null)

  const value = useMemo(
    () => ({
      enabled,
      status,
      organizations,
      storedOrganizationId: storedId,
      activeOrganization,
      selectOrganization,
      selectPersonal,
      reloadOrganizations,
    }),
    [
      enabled,
      status,
      organizations,
      storedId,
      activeOrganization,
      selectOrganization,
      selectPersonal,
      reloadOrganizations,
    ],
  )

  return <ActiveContext.Provider value={value}>{children}</ActiveContext.Provider>
}
