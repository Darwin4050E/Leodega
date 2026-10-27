import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mockNavigate,
}));
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ logout: mockLogout }) }));

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

describe('SidebarAdmin for the admin stays unchanged', () => {
  it('keeps the admin items and labels', () => {
    renderSidebar('admin');
    expect(navLabels()).toEqual([
      'Resumen',
      'Moderación',
      'Bodegas',
      'Reportes',
      'Usuarios',
      'Mensajes',
      'Páginas',
      'Configuración',
      'Cerrar sesión',
    ]);
  });

  it('keeps the admin routes', () => {
    renderSidebar('admin');
    fireEvent.click(screen.getByText('Bodegas'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/admin/bodegas');
    fireEvent.click(screen.getByText('Reportes'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/admin/solicitudes');
  });
});
