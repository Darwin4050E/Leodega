import { describe, it, expect, vi } from 'vitest';
import { notifyWalletChanged, subscribeToWalletChanges } from './walletEvents';

describe('walletEvents', () => {
  it('notifies every subscribed listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = subscribeToWalletChanges(first);
    const offSecond = subscribeToWalletChanges(second);

    notifyWalletChanged();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });

  it('stops notifying a listener once it unsubscribes, without affecting the others', () => {
    const removed = vi.fn();
    const kept = vi.fn();
    const offRemoved = subscribeToWalletChanges(removed);
    const offKept = subscribeToWalletChanges(kept);

    offRemoved();
    notifyWalletChanged();

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
    offKept();
  });

  it('is a no-op when nobody is subscribed', () => {
    expect(() => notifyWalletChanged()).not.toThrow();
  });
});
