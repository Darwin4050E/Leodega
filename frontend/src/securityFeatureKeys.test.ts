import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regression guard for the `security` JSON column's fourth key.
 *
 * The key was renamed `objetos` -> `acceso`. The backend cast
 * (backend/app/Casts/SecurityFeatures.php) reads only `acceso` and DISCARDS a
 * legacy `objetos` key rather than mapping it, so any production source that
 * still writes or reads `objetos` silently drops the feature.
 *
 * Scope: production sources under frontend/src only. Test files are exempt
 * because they deliberately name the legacy key to prove it is handled (this
 * file included), so `*.test.ts` / `*.test.tsx` are excluded from the sweep.
 */
const SRC_ROOT = dirname(fileURLToPath(import.meta.url));

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const isTestFile = (name: string) => /\.test\.[jt]sx?$/.test(name);

function collectProductionSources(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectProductionSources(full));
      continue;
    }

    if (isTestFile(entry.name)) continue;
    if (!SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;

    files.push(full);
  }

  return files;
}

describe('security feature keys', () => {
  it('no production source under src/ references the legacy `objetos` key', () => {
    const offenders = collectProductionSources(SRC_ROOT).filter((file) =>
      readFileSync(file, 'utf8').includes('objetos'),
    );

    expect(offenders).toEqual([]);
  });
});
