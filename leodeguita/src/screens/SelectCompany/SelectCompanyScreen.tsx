import { useCallback, useRef, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import { useActiveContext } from '../../context/useActiveContext'
import { ORGANIZATIONS_STATUS } from '../../context/activeContextBase'
import { ACTIVE_CONTEXT_COPY as COPY } from '../../context/activeContextCopy'
import type { Organization } from '../../services/organizations'
import { POST_LOGIN_GATE, organizationInitials, roleLabel } from './model'

function PersonAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg-t3"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    </span>
  )
}

function OrganizationAvatar({ organization }: { organization: Organization }) {
  if (organization.logo) {
    return (
      <img
        src={organization.logo}
        alt={COPY.logoAlt(organization.name)}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lg-primary text-sm font-semibold text-white"
    >
      {organizationInitials(organization.name)}
    </span>
  )
}

interface ContextRowProps {
  avatar: ReactNode
  name: string
  detail: string
  current: boolean
  personal?: boolean
  onSelect: () => void
}

function ContextRow({ avatar, name, detail, current, personal = false, onSelect }: ContextRowProps) {
  return (
    <li>
      <button
        type="button"
        aria-current={current || undefined}
        onClick={onSelect}
        className={`flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm ${
          current ? 'border-lg-primary' : 'border-lg-p100'
        }`}
      >
        <span className={`flex items-center gap-3 p-4 ${personal ? 'bg-amber-50' : 'bg-lg-soft'}`}>
          {avatar}
          <span className="min-w-0 flex-1 truncate text-[15px] text-lg-ink">{name}</span>
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-lg-p100 bg-white text-lg-t3"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </span>
        <span className="px-4 py-3 text-xs font-semibold text-lg-ink">{detail}</span>
      </button>
    </li>
  )
}

export default function SelectCompanyScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    status,
    organizations,
    storedOrganizationId,
    selectOrganization,
    selectPersonal,
    reloadOrganizations,
  } = useActiveContext()
  const picked = useRef(false)
  const focusHeading = useCallback((heading: HTMLHeadingElement | null) => heading?.focus(), [])

  const gated =
    (location.state as Record<string, unknown> | null)?.[POST_LOGIN_GATE] === true
  const loading = status === ORGANIZATIONS_STATUS.LOADING
  const failed = status === ORGANIZATIONS_STATUS.ERROR

  if (status === ORGANIZATIONS_STATUS.READY && organizations.length === 0) {
    return <Navigate to="/" replace />
  }
  if (gated && failed) return <Navigate to="/" replace />
  if (gated && status !== ORGANIZATIONS_STATUS.READY) {
    return (
      <PhoneFrame>
        <p role="status" className="m-auto text-sm text-lg-t3">
          {COPY.loading}
        </p>
      </PhoneFrame>
    )
  }

  function pick(select: () => void) {
    if (picked.current) return
    picked.current = true
    select()
    navigate('/', { replace: true })
  }

  return (
    <PhoneFrame>
      <div className="shrink-0 px-6 pb-2 pt-12">
        <h1
          ref={focusHeading}
          tabIndex={-1}
          className="m-0 text-2xl font-bold tracking-tight text-lg-ink outline-none"
        >
          {COPY.title}
        </h1>
        <p className="mt-1.5 text-sm text-lg-t3">{COPY.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <ContextRow
            personal
            avatar={<PersonAvatar />}
            name={COPY.personalName}
            detail={COPY.personalSub}
            current={storedOrganizationId === null}
            onSelect={() => pick(selectPersonal)}
          />
          {organizations.map((organization) => (
            <ContextRow
              key={organization.id}
              avatar={<OrganizationAvatar organization={organization} />}
              name={organization.name}
              detail={roleLabel(organization.role)}
              current={organization.id === storedOrganizationId}
              onSelect={() => pick(() => selectOrganization(organization.id))}
            />
          ))}
        </ul>

        {loading && (
          <p role="status" className="mt-4 text-center text-sm text-lg-t3">
            {COPY.loading}
          </p>
        )}
        {failed && (
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <p role="alert" className="text-sm text-lg-t3">
              {COPY.error}
            </p>
            <Button variant="sec" className="w-auto px-4" onClick={reloadOrganizations}>
              {COPY.retry}
            </Button>
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pb-8">
        <Button variant="sec" onClick={() => navigate('/', { replace: true })}>
          {COPY.back}
        </Button>
      </div>
    </PhoneFrame>
  )
}
