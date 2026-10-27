import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneFrame from '../../components/PhoneFrame'
import TenantTabBar from '../../components/TenantTabBar'
import Button from '../../components/Button'
import { useActiveContext } from '../../context/useActiveContext'
import { listTenantReservations, type TenantReservation } from '../../services/reservations'
import ReservationCard from './ReservationCard'
import ReservationTabs from './ReservationTabs'
import { RESERVATION_TABS, groupByTab, toCardViewModel, todayDateOnly, type ReservationTab } from './model'

/**
 * The tenant's reservations (`LgReservas` in the prototype, with the web
 * "Mis reservas" tabs and data contract). One fetch per active context: the
 * shared client sends the organization header, so switching context just
 * needs a reload. Cancel / review / report are intentionally not offered yet.
 */

type Phase = 'loading' | 'error' | 'ready'

function Header() {
  return (
    <div className="shrink-0 border-b border-lg-line bg-white px-5 pb-3 pt-12">
      <h1 className="m-0 text-xl font-bold tracking-tight text-lg-ink">Reservas</h1>
      <p className="m-0 mt-1 text-sm text-lg-t3">Tus arriendos</p>
    </div>
  )
}

export default function ReservationsScreen() {
  const navigate = useNavigate()
  const { storedOrganizationId } = useActiveContext()

  const [phase, setPhase] = useState<Phase>('loading')
  const [reservations, setReservations] = useState<TenantReservation[]>([])
  const [tab, setTab] = useState<ReservationTab>('activa')

  // A response from a context the user already switched away from must never
  // overwrite the current one.
  const latestRequest = useRef(0)

  const load = useCallback(() => {
    const requestId = ++latestRequest.current
    setPhase('loading')
    listTenantReservations()
      .then((result) => {
        if (requestId !== latestRequest.current) return
        setReservations(result)
        setPhase('ready')
      })
      .catch(() => {
        if (requestId !== latestRequest.current) return
        setReservations([])
        setPhase('error')
      })
  }, [])

  useEffect(() => {
    load()
  }, [load, storedOrganizationId])

  const grouped = useMemo(() => groupByTab(reservations), [reservations])
  const list = grouped[tab]
  const activeLabel = RESERVATION_TABS.find((t) => t.key === tab)?.label.toLowerCase() ?? ''

  let body
  if (phase === 'loading') {
    body = (
      <div className="flex flex-1 items-center justify-center px-6 text-sm text-lg-t3">
        Cargando reservas…
      </div>
    )
  } else if (phase === 'error') {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert" className="m-0 text-sm text-lg-t3">
          No pudimos cargar tus reservas. Intenta de nuevo.
        </p>
        <Button variant="sec" className="w-auto px-4" onClick={load}>
          Reintentar
        </Button>
      </div>
    )
  } else if (list.length === 0) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="m-0 text-sm font-semibold text-lg-ink">
          {tab === 'activa' ? 'Aún no tienes reservas' : `Aún no tienes reservas ${activeLabel}`}
        </p>
        <p className="m-0 text-sm text-lg-t3">Explora el catálogo y reserva tu bodega al instante.</p>
        <Button className="w-auto px-5" onClick={() => navigate('/bodegas')}>
          Explorar catálogo
        </Button>
      </div>
    )
  } else {
    const today = todayDateOnly()
    body = (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-6 pt-4">
        {list.map((reservation) => (
          <ReservationCard key={reservation.id} reservation={toCardViewModel(reservation, today)} />
        ))}
      </div>
    )
  }

  return (
    <PhoneFrame footer={<TenantTabBar />}>
      <Header />
      <ReservationTabs
        tabs={RESERVATION_TABS.map((t) => ({ ...t, count: grouped[t.key].length }))}
        selected={tab}
        onSelect={setTab}
      />
      {body}
    </PhoneFrame>
  )
}
