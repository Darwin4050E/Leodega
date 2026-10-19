import { useContext } from 'react'
import { ActiveContext } from './activeContextBase'

export function useActiveContext() {
  const ctx = useContext(ActiveContext)
  if (!ctx) {
    throw new Error('useActiveContext must be used inside <ActiveContextProvider>')
  }
  return ctx
}
