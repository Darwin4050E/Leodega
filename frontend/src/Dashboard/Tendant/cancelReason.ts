export const REASON_MIN = 10;
export const REASON_MAX = 200;

/** Trimmed length in code points, matching the server's `mb_strlen` after trim (JS `.length` counts UTF-16 units). */
export function reasonLength(value: string): number {
  return Array.from(value.trim()).length;
}
