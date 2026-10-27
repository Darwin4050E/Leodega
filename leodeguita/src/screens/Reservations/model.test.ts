import { describe, it, expect } from 'vitest'
import type { TenantReservation } from '../../services/reservations'
import { deriveTab, formatAmount, formatReservationCode, groupByTab, toCardViewModel } from './model'

function reservation(overrides: Partial<TenantReservation> = {}): TenantReservation {
  return {
    id: 42,
    status: 'confirmed',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    store_room_id: 3,
    total_mount: '150.5',
    photo_url: null,
    ...overrides,
  }
}

describe('deriveTab', () => {
  const TODAY = '2026-06-15'

  it('puts a canceled reservation in cancelada', () => {
    expect(deriveTab(reservation({ status: 'canceled' }), TODAY)).toBe('cancelada')
  })

  it('puts a confirmed reservation that already ended in finalizada', () => {
    expect(deriveTab(reservation({ end_date: '2026-06-14' }), TODAY)).toBe('finalizada')
  })

  it('keeps a confirmed reservation ending today or later in activa', () => {
    expect(deriveTab(reservation({ end_date: '2026-06-15' }), TODAY)).toBe('activa')
    expect(deriveTab(reservation({ end_date: '2026-07-01' }), TODAY)).toBe('activa')
  })

  it('keeps an unpaid pending reservation in activa even when its dates passed', () => {
    expect(deriveTab(reservation({ status: 'pending', end_date: '2026-01-02' }), TODAY)).toBe('activa')
  })
})

describe('groupByTab', () => {
  it('buckets reservations preserving order', () => {
    const rows = [
      reservation({ id: 1, status: 'canceled' }),
      reservation({ id: 2 }),
      reservation({ id: 3 }),
    ]

    const grouped = groupByTab(rows, '2026-06-15')

    expect(grouped.activa.map((r) => r.id)).toEqual([2, 3])
    expect(grouped.cancelada.map((r) => r.id)).toEqual([1])
    expect(grouped.finalizada).toEqual([])
  })
})

describe('formatReservationCode', () => {
  it('zero-pads the real id, matching the backend and the web', () => {
    expect(formatReservationCode(42)).toBe('LEO-000042')
  })
})

describe('formatAmount', () => {
  it.each([
    ['150.5', '$150.50'],
    [150, '$150.00'],
    [null, '$0.00'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatAmount(value)).toBe(expected)
  })
})

describe('toCardViewModel', () => {
  it('maps the room, period, amount, code and tab', () => {
    const vm = toCardViewModel(
      reservation({
        store_rooms: { title: 'Bodega Norte', direction: 'Km 11', city: 'Guayaquil', size: 45 },
        organization: { id: 1, name: 'Andina', ruc: '1' },
        creator_name: 'Ana Perez',
      }),
      '2026-06-15',
    )

    expect(vm).toMatchObject({
      id: 42,
      title: 'Bodega Norte',
      location: 'Km 11, Guayaquil · 45 m²',
      period: '2026-01-01 → 2026-12-31',
      amount: '$150.50',
      code: 'LEO-000042',
      tab: 'activa',
      organizationName: 'Andina',
      creatorName: 'Ana Perez',
      refund: null,
      photo: null,
    })
  })

  it('falls back when the room is missing and shows the refund only when canceled', () => {
    const vm = toCardViewModel(reservation({ status: 'canceled', refund_amount: '20' }), '2026-06-15')

    expect(vm.title).toBe('Bodega')
    expect(vm.location).toBe('')
    expect(vm.refund).toBe('$20.00')
    expect(vm.organizationName).toBeNull()
  })

  it('hides the creator when the reservation is personal', () => {
    expect(toCardViewModel(reservation({ creator_name: 'Ana' }), '2026-06-15').creatorName).toBeNull()
  })
})
