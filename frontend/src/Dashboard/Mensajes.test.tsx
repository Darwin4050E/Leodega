import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import React from 'react';

const mockGetMe = vi.hoisted(() => vi.fn());
const mockGetConversations = vi.hoisted(() => vi.fn());
const mockGetMessages = vi.hoisted(() => vi.fn());
const mockMarkConversationRead = vi.hoisted(() => vi.fn());
const mockCreateConversation = vi.hoisted(() => vi.fn());
const mockGetUsers = vi.hoisted(() => vi.fn());

vi.mock('../services/conversations', () => ({
  getMe: mockGetMe,
  getConversations: mockGetConversations,
  getMessages: mockGetMessages,
  markConversationRead: mockMarkConversationRead,
  sendMessage: vi.fn(),
  createConversation: mockCreateConversation,
}));

vi.mock('../services/users', () => ({
  getUsers: mockGetUsers,
}));

import Mensajes from './Mensajes';

// jsdom does not implement scrollIntoView; the component calls it whenever
// the messages list changes, unrelated to the query-param behavior tested here.
Element.prototype.scrollIntoView = vi.fn();

const authUser = { id: 1, name: 'Gestor', lastname: 'Uno' };
const newConversation = {
  id: 99,
  users: [authUser, { id: 42, name: 'Tenant', lastname: 'Cliente' }],
  unread_count: 0,
};

const SearchParamsProbe = () => {
  const [searchParams] = useSearchParams();
  return <div data-testid="search-params-probe">{searchParams.toString()}</div>;
};

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Mensajes />
      <SearchParamsProbe />
    </MemoryRouter>
  );
}

describe('Mensajes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMe.mockResolvedValue({ data: { user: authUser } });
    mockGetConversations.mockResolvedValue({ data: [] });
    mockGetMessages.mockResolvedValue({ data: { data: [] } });
    mockMarkConversationRead.mockResolvedValue({});
    mockCreateConversation.mockResolvedValue({ data: newConversation });
  });

  it('opens the conversation once for a valid numeric userId query param', async () => {
    renderWithRoute('/arrendador/mensajes?userId=42');

    await waitFor(() => expect(mockCreateConversation).toHaveBeenCalledTimes(1));
    expect(mockCreateConversation).toHaveBeenCalledWith(42);
    await waitFor(() => expect(screen.getByText('Chat')).toBeInTheDocument());
  });

  it('does not call startConversation when userId is missing', async () => {
    renderWithRoute('/arrendador/mensajes');

    await waitFor(() => expect(mockGetConversations).toHaveBeenCalled());
    expect(mockCreateConversation).not.toHaveBeenCalled();
    expect(screen.getByText('Selecciona una conversación')).toBeInTheDocument();
  });

  it.each(['abc', '0', '-5', ''])(
    'does not call startConversation for an invalid userId=%s, and clears the param',
    async (invalid) => {
      renderWithRoute(`/arrendador/mensajes?userId=${invalid}`);

      await waitFor(() => expect(mockGetConversations).toHaveBeenCalled());
      expect(mockCreateConversation).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByTestId('search-params-probe')).toHaveTextContent('')
      );
    }
  );

  it('still calls startConversation only once under React StrictMode double-invoke', async () => {
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/arrendador/mensajes?userId=42']}>
          <Mensajes />
        </MemoryRouter>
      </React.StrictMode>
    );

    await waitFor(() => expect(mockCreateConversation).toHaveBeenCalledTimes(1));
  });
});
