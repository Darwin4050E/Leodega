/**
 * Money formatting pinned to `'en-US'` (comma thousands, e.g. `$1,440`).
 *
 * The prototype's bare `monto.toLocaleString()` renders comma-grouped output
 * only because it happens to run under an `en-US` locale. Pinning the
 * locale explicitly reproduces that shape deterministically regardless of
 * the browser's ambient locale (which could otherwise render `$1.440` under
 * `'es-EC'`).
 */
export function formatUSD(value: string | number, opts?: { suffix?: boolean }): string {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const formatted = `$${safe.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

  return opts?.suffix ? `${formatted} USD` : formatted;
}
