import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mockNavigate,
}));
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ logout: mockLogout }) }));

const mockGetDashboardSummary = vi.hoisted(() => vi.fn());
vi.mock('../services/dashboard', () => ({ getDashboardSummary: mockGetDashboardSummary }));

import SidebarAdmin from './SidebarAdmin';

const renderSidebar = (role: 'admin' | 'landlord', activeItem = 'bodegas') => {
  const setActiveItem = vi.fn();
  render(
    <MemoryRouter>
      <SidebarAdmin activeItem={activeItem} setActiveItem={setActiveItem} role={role} />
    </MemoryRouter>
  );
  return setActiveItem;
};

const navLabels = () =>
  Array.from(document.querySelectorAll('nav button, nav p')).map((el) => el.textContent?.trim());

describe('SidebarAdmin for the gestor (landlord)', () => {
  it('lists the gestor items in prototype order', () => {
    renderSidebar('landlord');
    expect(navLabels()).toEqual([
      'Mis bodegas',
      'Publicar bodega',
      'Reservas',
      'Mensajes',
      'Páginas',
      'Calendario',
      'Configuración',
      'Cerrar sesión',
    ]);
  });

  it('navigates Mis bodegas and Reservas to the existing routes', () => {
    renderSidebar('landlord');
    fireEvent.click(screen.getByText('Mis bodegas'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/arrendador/bodegas');
    fireEvent.click(screen.getByText('Reservas'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/arrendador/solicitudes');
  });

  it('sends Publicar bodega to the first wizard step', () => {
    const setActiveItem = renderSidebar('landlord');
    fireEvent.click(screen.getByText('Publicar bodega'));
    expect(setActiveItem).toHaveBeenCalledWith('publicar');
    expect(mockNavigate).toHaveBeenLastCalledWith('/preguntainicio1');
  });

  it('highlights the active item, including Publicar bodega', () => {
    renderSidebar('landlord', 'publicar');
    expect(screen.getByText('Publicar bodega').closest('button')?.className).toContain('bg-[#FFB84D]');
    expect(screen.getByText('Mis bodegas').closest('button')?.className).not.toContain('bg-[#FFB84D]');
  });
});

describe('SidebarAdmin for the gestor does not load admin data', () => {
  it('never requests the dashboard summary', () => {
    mockGetDashboardSummary.mockClear();
    renderSidebar('landlord');
    expect(mockGetDashboardSummary).not.toHaveBeenCalled();
  });
});

describe('SidebarAdmin for the admin follows the prototype', () => {
  beforeEach(() => {
    mockGetDashboardSummary.mockReset();
    mockGetDashboardSummary.mockResolvedValue({ data: { pending_moderation: 3 } });
  });

  it('lists the admin items in prototype order without Bodegas', async () => {
    renderSidebar('admin', 'resumen');
    await screen.findByText('3');
    expect(navLabels()).toEqual([
      'Resumen',
      'Bodegas por aprobar3',
      'Gestión de cuentas',
      'Reportes',
      'Mensajes',
      'Páginas',
      'Configuración',
      'Cerrar sesión',
    ]);
  });

  it('navigates to the admin routes', () => {
    renderSidebar('admin');
    fireEvent.click(screen.getByText('Bodegas por aprobar'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/admin/moderacion');
    fireEvent.click(screen.getByText('Gestión de cuentas'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/admin/usuarios');
    fireEvent.click(screen.getByText('Reportes'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/admin/solicitudes');
  });

  it('hides the badge when nothing is pending', async () => {
    mockGetDashboardSummary.mockResolvedValue({ data: { pending_moderation: 0 } });
    renderSidebar('admin');
    await waitFor(() => expect(mockGetDashboardSummary).toHaveBeenCalled());
    expect(navLabels()).toContain('Bodegas por aprobar');
  });

  it('degrades silently when the summary request fails', async () => {
    mockGetDashboardSummary.mockRejectedValue(new Error('boom'));
    renderSidebar('admin');
    await waitFor(() => expect(mockGetDashboardSummary).toHaveBeenCalled());
    expect(navLabels()).toContain('Bodegas por aprobar');
  });

  it('highlights nothing for the hidden Bodegas page', () => {
    renderSidebar('admin', 'bodegas');
    expect(document.querySelectorAll('nav button.bg-\\[\\#FFB84D\\]').length).toBe(0);
  });
});
