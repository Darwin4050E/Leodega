import { useContext } from 'react';
import { ActiveContext, type ActiveContextValue } from './activeContextBase';

export function useActiveContext(): ActiveContextValue {
  const ctx = useContext(ActiveContext);
  if (!ctx) {
    throw new Error('useActiveContext debe usarse dentro de <ActiveContextProvider>');
  }
  return ctx;
}
