import { describe, it, expect } from 'vitest'
import type { LandlordReservation } from '../../services/reservations'
import { clientName, deriveLandlordTab, groupLandlord, toLandlordRow } from './landlordModel'

function reservation(overrides: Partial<LandlordReservation> = {}): LandlordReservation {
  return {
    id: 5,
    status: 'confirmed',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    store_room_id: 3,
    total_mount: '150.5',
    store_rooms: { id: 3, title: 'Bodega Norte' },
    tenants: { user: { name: 'Luis', lastname: 'Mora' } },
    ...overrides,
  }
}

const TODAY = '2026-06-15'

describe('deriveLandlordTab', () => {
  it('puts a confirmed reservation that has not ended in activa', () => {
    expect(deriveLandlordTab(reservation({ end_date: '2026-06-15' }), TODAY)).toBe('activa')
  })

  it('puts a confirmed reservation that already ended in finalizada', () => {
    expect(deriveLandlordTab(reservation({ end_date: '2026-06-14' }), TODAY)).toBe('finalizada')
  })

  it('leaves canceled and unpaid (pending) reservations out of both tabs', () => {
    expect(deriveLandlordTab(reservation({ status: 'canceled' }), TODAY)).toBeNull()
    expect(deriveLandlordTab(reservation({ status: 'pending' }), TODAY)).toBeNull()
  })
})

describe('groupLandlord', () => {
  it('groups by tab and drops the hidden ones', () => {
    const grouped = groupLandlord(
      [
        reservation({ id: 1 }),
        reservation({ id: 2, end_date: '2020-01-01' }),
        reservation({ id: 3, status: 'canceled' }),
      ],
      TODAY,
    )

    expect(grouped.activa.map((r) => r.id)).toEqual([1])
    expect(grouped.finalizada.map((r) => r.id)).toEqual([2])
  })
})

describe('clientName', () => {
  it('joins name and lastname', () => {
    expect(clientName(reservation())).toBe('Luis Mora')
  })

  it('falls back to "Cliente"', () => {
    expect(clientName(reservation({ tenants: undefined }))).toBe('Cliente')
  })
})

describe('toLandlordRow', () => {
  it('maps the fields the row shows', () => {
    expect(toLandlordRow(reservation(), TODAY)).toEqual({
      id: 5,
      title: 'Bodega Norte',
      client: 'Luis Mora',
      period: '2026-01-01 — 2026-12-31',
      amount: '$150.50',
      tab: 'activa',
    })
  })

  it('falls back to "Bodega" without a store room', () => {
    expect(toLandlordRow(reservation({ store_rooms: undefined }), TODAY).title).toBe('Bodega')
  })
})
