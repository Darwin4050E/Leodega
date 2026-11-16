import { describe, it, expect } from 'vitest'
import type { StoreRoomDetail } from '../../services/storeRooms'
import { EMPTY_STORE_ROOM } from './model'
import {
  buildEditPayload,
  hasMonthlyPrice,
  isEditStepComplete,
  storeRoomToFormValues,
} from './editModel'

function detail(overrides: Partial<StoreRoomDetail> = {}): StoreRoomDetail {
  return {
    id: 1,
    title: 'Bodega Norte',
    description: 'Espacio amplio',
    direction: 'Km 11.5',
    city: 'Guayaquil',
    size: '45.00',
    room_type: 'bodega',
    storage_type: 'completa',
    security: '{"camara":true,"ruido":false}',
    prices: [{ mode: 'month', price: '150.00', disponibility: 1 }],
    photos: ['https://example.com/a.jpg'],
    landlord: { id: 7, user_id: 1, name: 'J', email: 'j@x.com', phone: null },
    latitude: -2.15,
    longitude: -79.9,
    rating_avg: 0,
    rating_count: 0,
    active_reservations_count: 0,
    is_available_now: true,
    ...overrides,
  }
}

describe('storeRoomToFormValues', () => {
  it('maps the detail payload onto the wizard values', () => {
    expect(storeRoomToFormValues(detail())).toEqual({
      ...EMPTY_STORE_ROOM,
      room_type: 'bodega',
      storage_type: 'completa',
      direction: 'Km 11.5',
      city: 'Guayaquil',
      title: 'Bodega Norte',
      description: 'Espacio amplio',
      size: '45',
      monthly_price: '150',
      security: { camara: true },
      latitude: -2.15,
      longitude: -79.9,
    })
  })

  it('leaves the price empty when there is no monthly row', () => {
    const values = storeRoomToFormValues(
      detail({ prices: [{ mode: 'day', price: 5, disponibility: 1 }] }),
    )
    expect(values.monthly_price).toBe('')
  })
})

describe('hasMonthlyPrice', () => {
  it('is true only with a month-mode row', () => {
    expect(hasMonthlyPrice(detail())).toBe(true)
    expect(
      hasMonthlyPrice(detail({ prices: [{ mode: 'day', price: 5, disponibility: 1 }] })),
    ).toBe(false)
  })
})

describe('buildEditPayload', () => {
  const initial = storeRoomToFormValues(detail())

  it('is empty when nothing changed (representation differences ignored)', () => {
    expect(buildEditPayload(initial, { ...initial, title: '  Bodega Norte ' }, true)).toEqual({})
  })

  it('sends only the changed editable fields, numbers as numbers', () => {
    const changed = {
      ...initial,
      title: ' Nueva ',
      size: '50',
      monthly_price: '175.5',
    }
    expect(buildEditPayload(initial, changed, true)).toEqual({
      title: 'Nueva',
      size: 50,
      price: 175.5,
    })
  })

  it('sends the description when it changes', () => {
    expect(
      buildEditPayload(initial, { ...initial, description: 'Otro texto' }, true),
    ).toEqual({ description: 'Otro texto' })
  })

  it('never sends a price when the room has no monthly row', () => {
    expect(
      buildEditPayload(initial, { ...initial, monthly_price: '999' }, false),
    ).toEqual({})
  })

  it('ignores fields the backend cannot edit', () => {
    expect(
      buildEditPayload(initial, { ...initial, city: 'Quito', room_type: 'garaje' }, true),
    ).toEqual({})
  })
})

describe('isEditStepComplete', () => {
  const values = storeRoomToFormValues(detail())

  it('treats the read-only steps and the optional permit as complete', () => {
    for (const step of [0, 1, 2, 3, 6]) {
      expect(isEditStepComplete(step, EMPTY_STORE_ROOM, true)).toBe(true)
    }
  })

  it('requires title and description on step 4', () => {
    expect(isEditStepComplete(4, values, true)).toBe(true)
    expect(isEditStepComplete(4, { ...values, title: ' ' }, true)).toBe(false)
    expect(isEditStepComplete(4, { ...values, description: '' }, true)).toBe(false)
  })

  it('requires a positive size, and a price only when the room has one', () => {
    expect(isEditStepComplete(5, values, true)).toBe(true)
    expect(isEditStepComplete(5, { ...values, size: '0' }, true)).toBe(false)
    expect(isEditStepComplete(5, { ...values, monthly_price: '' }, true)).toBe(false)
    expect(isEditStepComplete(5, { ...values, monthly_price: '' }, false)).toBe(true)
  })
})
