import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PanelPagination from './PanelPagination';

function renderPagination(page: number, lastPage: number, onPageChange = vi.fn()) {
  render(<PanelPagination page={page} lastPage={lastPage} onPageChange={onPageChange} />);
  return onPageChange;
}

describe('PanelPagination', () => {
  it('is hidden when there is a single page', () => {
    renderPagination(1, 1);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('WS40: shows the page counter, with Anterior disabled on the first page', () => {
    renderPagination(1, 3);

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('WS40: disables Siguiente on the last page', () => {
    renderPagination(3, 3);

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('asks for the next and the previous page only', async () => {
    const onPageChange = renderPagination(2, 3);

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('WS80: the buttons are reachable in order and a disabled one is announced as disabled', async () => {
    renderPagination(1, 2);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveAttribute('disabled');
  });
});
