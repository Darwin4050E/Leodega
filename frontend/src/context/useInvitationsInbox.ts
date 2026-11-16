import { useContext } from 'react';
import { InvitationsInboxContext, type InvitationsInboxValue } from './invitationsInboxBase';

/**
 * Unlike `useActiveContext` this never throws: outside the provider it returns
 * an inert value, so components that only show the count (switcher, drawer)
 * render unchanged where the provider is absent.
 */
export function useInvitationsInbox(): InvitationsInboxValue {
  return useContext(InvitationsInboxContext);
}
