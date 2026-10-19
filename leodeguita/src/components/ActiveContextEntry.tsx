import { useNavigate } from 'react-router-dom'
import Button from './Button'
import { useActiveContext } from '../context/useActiveContext'
import { ORGANIZATIONS_STATUS } from '../context/activeContextBase'
import { ACTIVE_CONTEXT_COPY as COPY } from '../context/activeContextCopy'

export default function ActiveContextEntry() {
  const navigate = useNavigate()
  const { enabled, status, organizations, storedOrganizationId, activeOrganization, reloadOrganizations } =
    useActiveContext()

  const hidden =
    !enabled ||
    status === ORGANIZATIONS_STATUS.IDLE ||
    (status === ORGANIZATIONS_STATUS.READY && organizations.length === 0)
  if (hidden) return null

  let label: string = COPY.operatingAs(COPY.personalName)
  if (activeOrganization) label = COPY.operatingAs(activeOrganization.name)
  else if (storedOrganizationId !== null) label = COPY.operatingAsUnknown

  return (
    <section className="mt-6 rounded-2xl border border-lg-p100 bg-lg-soft p-4">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-lg-ink">{label}</p>
        <Button
          variant="sec"
          className="w-auto px-4 py-2"
          aria-label={COPY.changeLabel}
          onClick={() => navigate('/empresa')}
        >
          {COPY.change}
        </Button>
      </div>
      {status === ORGANIZATIONS_STATUS.LOADING && (
        <p role="status" className="mt-3 text-xs text-lg-t3">
          {COPY.loading}
        </p>
      )}
      {status === ORGANIZATIONS_STATUS.ERROR && (
        <div className="mt-3 flex items-center gap-3">
          <p role="alert" className="min-w-0 flex-1 text-xs text-lg-t3">
            {COPY.error}
          </p>
          <Button variant="ghost" className="w-auto px-3 py-1.5" onClick={reloadOrganizations}>
            {COPY.retry}
          </Button>
        </div>
      )}
    </section>
  )
}
