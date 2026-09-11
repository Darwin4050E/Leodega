import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WizardProvider, useWizard } from './WizardContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <WizardProvider>{children}</WizardProvider>
);

const makeFile = (name: string, type = 'image/jpeg') =>
  new File(['content'], name, { type });

describe('WizardProvider / useWizard', () => {
  it('starts with empty photos and null permit', () => {
    const { result } = renderHook(() => useWizard(), { wrapper });
    expect(result.current.photos).toEqual([]);
    expect(result.current.permit).toBeNull();
  });

  it('setPhotos updates the photos state', () => {
    const { result } = renderHook(() => useWizard(), { wrapper });
    const files = [makeFile('a.jpg'), makeFile('b.jpg')];

    act(() => {
      result.current.setPhotos(files);
    });

    expect(result.current.photos).toHaveLength(2);
    expect(result.current.photos[0].name).toBe('a.jpg');
  });

  it('setPermit updates the permit state', () => {
    const { result } = renderHook(() => useWizard(), { wrapper });
    const permit = makeFile('permit.pdf', 'application/pdf');

    act(() => {
      result.current.setPermit(permit);
    });

    expect(result.current.permit).not.toBeNull();
    expect(result.current.permit?.name).toBe('permit.pdf');
  });

  it('reset clears photos to [] and permit to null', () => {
    const { result } = renderHook(() => useWizard(), { wrapper });

    act(() => {
      result.current.setPhotos([makeFile('x.jpg')]);
      result.current.setPermit(makeFile('permit.pdf', 'application/pdf'));
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.permit).toBeNull();
  });

  it('useWizard throws when used outside WizardProvider', () => {
    expect(() => renderHook(() => useWizard())).toThrow(
      'useWizard must be used inside WizardProvider'
    );
  });
});
