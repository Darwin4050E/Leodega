type WalletChangeListener = () => void;

const listeners = new Set<WalletChangeListener>();

/**
 * Module-level event bus (same idiom as `subscribeToForcedPersonal`): lets any
 * screen that moves money tell the balance consumers to refetch, without
 * reloading the organization list (which would flip the context to LOADING).
 */
export function notifyWalletChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToWalletChanges(listener: WalletChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
