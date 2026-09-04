import { describe, it, expect } from 'vitest';
import { formatUSD } from './money';

describe('formatUSD', () => {
  it('formats with comma thousands separators (en-US), not periods (es-EC)', () => {
    expect(formatUSD(1440)).toBe('$1,440');
  });

  it('accepts a numeric string', () => {
    expect(formatUSD('1440')).toBe('$1,440');
  });

  it('appends " USD" only when suffix is requested', () => {
    expect(formatUSD(1440, { suffix: true })).toBe('$1,440 USD');
    expect(formatUSD(1440, { suffix: false })).toBe('$1,440');
  });

  it('falls back to $0 for non-numeric input instead of throwing or showing NaN', () => {
    expect(formatUSD('not-a-number')).toBe('$0');
  });

  it('formats large amounts with multiple thousand separators', () => {
    expect(formatUSD(1234567)).toBe('$1,234,567');
  });
});
