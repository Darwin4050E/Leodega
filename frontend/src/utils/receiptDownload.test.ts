import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetReservationReceiptPdf = vi.hoisted(() => vi.fn());

vi.mock('../services/reservations', () => ({
  getReservationReceiptPdf: mockGetReservationReceiptPdf,
}));

import { receiptFilename, saveBlob, downloadReservationReceipt } from './receiptDownload';

const ERROR_MESSAGE = 'No se pudo descargar el comprobante. Inténtalo de nuevo.';

describe('receiptDownload', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clicked: { download: string; href: string }[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    createObjectURL = vi.fn(() => 'blob:receipt-url');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clicked = [];
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push({ download: this.download, href: this.href });
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
    vi.useRealTimers();
  });

  it('receiptFilename builds the filename from the zero-padded reservation code', () => {
    expect(receiptFilename(42)).toBe('comprobante-LEO-000042.pdf');
    expect(receiptFilename(123456)).toBe('comprobante-LEO-123456.pdf');
  });

  it('saveBlob clicks a download anchor for the object URL and defers the revoke', () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });

    saveBlob(blob, 'comprobante-LEO-000042.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ download: 'comprobante-LEO-000042.pdf', href: 'blob:receipt-url' }]);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-url');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('downloadReservationReceipt fetches the PDF and saves it under the reservation filename', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    mockGetReservationReceiptPdf.mockResolvedValue({ data: blob });

    await downloadReservationReceipt(42);

    expect(mockGetReservationReceiptPdf).toHaveBeenCalledWith(42);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked[0].download).toBe('comprobante-LEO-000042.pdf');
  });

  it.each([
    ['403', { response: { status: 403, data: new Blob(['{"message":"x"}']) } }],
    ['404', { response: { status: 404, data: new Blob(['{"message":"y"}']) } }],
    ['409', { response: { status: 409, data: new Blob(['{}']) } }],
    ['500', { response: { status: 500, data: new Blob([]) } }],
    ['network', new Error('Network Error')],
  ])('downloadReservationReceipt throws the single generic message on %s', async (_label, failure) => {
    mockGetReservationReceiptPdf.mockRejectedValue(failure);

    await expect(downloadReservationReceipt(42)).rejects.toThrow(ERROR_MESSAGE);
    expect(clicked).toHaveLength(0);
  });

  it('downloadReservationReceipt throws the generic message when saving the file fails', async () => {
    mockGetReservationReceiptPdf.mockResolvedValue({ data: new Blob(['%PDF']) });
    createObjectURL.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(downloadReservationReceipt(42)).rejects.toThrow(ERROR_MESSAGE);
  });
});
