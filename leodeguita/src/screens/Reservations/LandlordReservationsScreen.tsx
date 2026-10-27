import { useCallback, useEffect, useMemo, useState } from 'react'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import StatusChip from '../../components/StatusChip'
import { listLandlordReservations, type LandlordReservation } from '../../services/reservations'
import ReservationTabs from './ReservationTabs'
import { LANDLORD_TABS, groupLandlord, toLandlordRow, type LandlordTab } from './landlordModel'
import { todayDateOnly } from './model'

/**
 * The gestor's received reservations (`LgReservas` with `role="gestor"` in
 * the prototype). Read-only: cancel and payment receipt stay on the web.
 */

type Phase = 'loading' | 'error' | 'ready'

function Header() {
  return (
    <div className="shrink-0 border-b border-lg-line bg-white px-5 pb-3 pt-12">
      <h1 className="m-0 text-xl font-bold tracking-tight text-lg-ink">Reservas</h1>
      <p className="m-0 mt-1 text-sm text-lg-t3">Reservas de tus bodegas</p>
    </div>
  )
}

export default function LandlordReservationsScreen() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [reservations, setReservations] = useState<LandlordReservation[]>([])
  const [tab, setTab] = useState<LandlordTab>('activa')

  const load = useCallback(() => {
    setPhase('loading')
    listLandlordReservations()
      .then((result) => {
        setReservations(result)
        setPhase('ready')
      })
      .catch(() => {
        setReservations([])
        setPhase('error')
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = todayDateOnly()
  const grouped = useMemo(() => groupLandlord(reservations, today), [reservations, today])
  const list = grouped[tab]

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
          No pudimos cargar las reservas. Intenta de nuevo.
        </p>
        <Button variant="sec" className="w-auto px-4" onClick={load}>
          Reintentar
        </Button>
      </div>
    )
  } else if (list.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="m-0 text-sm text-lg-t3">
          {tab === 'activa' ? 'Aún no has recibido reservas' : 'Aún no tienes reservas finalizadas'}
        </p>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-6 pt-4">
        {list.map((reservation) => {
          const row = toLandlordRow(reservation, today)
          return (
            <article key={row.id} className="rounded-2xl border border-lg-line bg-white p-4 shadow-sm">
              <StatusChip tone={tab === 'activa' ? 'ok' : 'neutral'}>
                {tab === 'activa' ? 'Activa' : 'Finalizada'}
              </StatusChip>
              <h3 className="m-0 mt-1.5 text-sm font-bold text-lg-ink">{row.title}</h3>
              <p className="m-0 mt-1 text-xs text-lg-t3">
                <span className="font-semibold text-lg-t2">{row.client}</span> · {row.period}
              </p>
              <p className="m-0 mt-2 text-sm font-bold text-lg-primary">
                {row.amount} <span className="text-xs font-normal text-lg-t3">total</span>
              </p>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <PhoneFrame>
      <Header />
      <ReservationTabs
        tabs={LANDLORD_TABS.map((t) => ({ ...t, count: grouped[t.key].length }))}
        selected={tab}
        onSelect={setTab}
      />
      {body}
    </PhoneFrame>
  )
}
