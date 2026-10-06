import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockCreateOrganization = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../../services/organizations', () => ({
  createOrganization: mockCreateOrganization,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../../Components/HeaderTendant', () => ({
  default: () => <div data-testid="header-tendant" />,
}));

import CrearOrganizacion from './CrearOrganizacion';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const FALLBACK = 'No se pudo crear la organización. Intenta nuevamente';

function organization(overrides = {}) {
  return {
    id: 7,
    name: 'Importadora Andina S.A.',
    ruc: '1790012345001',
    email: 'ops@andina.com',
    logo: null,
    status: 'active',
    role: 'admin',
    ...overrides,
  };
}

function created(overrides = {}) {
  return { data: { message: 'Organización creada correctamente', organization: organization(overrides) } };
}

function apiError(status: number, data: Record<string, unknown>) {
  return { response: { status, data } };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/mi-cuenta/crear-organizacion']}>
      <Routes>
        <Route path="/mi-cuenta/crear-organizacion" element={<CrearOrganizacion />} />
        <Route path="/" element={<div>Inicio público</div>} />
        <Route path="/arrendatario/dashboard" element={<div>Panel del arrendatario</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function setRole(role: string) {
  mockUseAuth.mockReturnValue({ token: 't', user: { id: 1, role } });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Razón social'), 'Importadora Andina S.A.');
  await user.type(screen.getByLabelText('RUC'), '1790012345001');
  await user.type(screen.getByLabelText('Correo de la organización'), 'ops@andina.com');
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Crear organización' }));

describe('CrearOrganizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('tenant');
    URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('access', () => {
    it('shows the form with razón social, RUC and correo to a tenant', () => {
      renderPage();

      expect(screen.getByLabelText('Razón social')).toBeInTheDocument();
      expect(screen.getByLabelText('RUC')).toBeInTheDocument();
      expect(screen.getByLabelText('Correo de la organización')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Crear organización' })).toBeInTheDocument();
    });

    it.each(['landlord', 'admin'])('redirects a %s to / without rendering the form', (role) => {
      setRole(role);

      renderPage();

      expect(screen.getByText('Inicio público')).toBeInTheDocument();
      expect(screen.queryByLabelText('Razón social')).not.toBeInTheDocument();
    });
  });

  describe('client validation', () => {
    it('shows every message and sends no request for an empty form', async () => {
      const user = userEvent.setup();
      renderPage();

      await submit(user);

      expect(screen.getByText('La razón social es obligatoria')).toBeInTheDocument();
      expect(screen.getByText('El RUC es obligatorio')).toBeInTheDocument();
      expect(screen.getByText('Ingresa un correo válido para la organización')).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it('rejects a RUC that is not 13 digits', async () => {
      const user = userEvent.setup();
      renderPage();
      await fillValid(user);
      await user.clear(screen.getByLabelText('RUC'));
      await user.type(screen.getByLabelText('RUC'), '123');

      await submit(user);

      expect(screen.getByText('El RUC debe tener 13 dígitos')).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it('rejects a 13-digit RUC that does not end in 001', async () => {
      const user = userEvent.setup();
      renderPage();
      await fillValid(user);
      await user.clear(screen.getByLabelText('RUC'));
      await user.type(screen.getByLabelText('RUC'), '1790012345002');

      await submit(user);

      expect(screen.getByText('El RUC debe terminar en 001')).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it('rejects an invalid email', async () => {
      const user = userEvent.setup();
      renderPage();
      await fillValid(user);
      await user.clear(screen.getByLabelText('Correo de la organización'));
      await user.type(screen.getByLabelText('Correo de la organización'), 'abc');

      await submit(user);

      expect(screen.getByText('Ingresa un correo válido para la organización')).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it('strips non-digits from the RUC and caps it at 13 characters', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('RUC'), '17-90 01x2345001999');

      expect(screen.getByLabelText('RUC')).toHaveValue('1790012345001');
    });

    it('clears a field error as soon as that field is edited', async () => {
      const user = userEvent.setup();
      renderPage();
      await submit(user);
      expect(screen.getByText('La razón social es obligatoria')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Razón social'), 'A');

      expect(screen.queryByText('La razón social es obligatoria')).not.toBeInTheDocument();
      expect(screen.getByText('El RUC es obligatorio')).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('sends the trimmed values with no logo when none is selected', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValue(created());
      renderPage();
      await user.type(screen.getByLabelText('Razón social'), '  Importadora Andina S.A.  ');
      await user.type(screen.getByLabelText('RUC'), '1790012345001');
      await user.type(screen.getByLabelText('Correo de la organización'), ' ops@andina.com ');

      await submit(user);

      await waitFor(() => expect(mockCreateOrganization).toHaveBeenCalledTimes(1));
      const payload = mockCreateOrganization.mock.calls[0][0];
      expect(payload).toEqual({
        name: 'Importadora Andina S.A.',
        ruc: '1790012345001',
        email: 'ops@andina.com',
        logo: null,
      });
      expect(await screen.findByText('Organización creada correctamente')).toBeInTheDocument();
    });

    it('shows the 422 message under the matching field and keeps the entered values', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValue(
        apiError(422, {
          message: 'The given data was invalid.',
          errors: { ruc: ['Ya existe una organización registrada con este RUC'] },
        }),
      );
      renderPage();
      await fillValid(user);

      await submit(user);

      const ruc = screen.getByLabelText('RUC');
      await waitFor(() =>
        expect(ruc).toHaveAccessibleDescription('Ya existe una organización registrada con este RUC'),
      );
      expect(ruc).toHaveValue('1790012345001');
      expect(screen.getByLabelText('Razón social')).toHaveValue('Importadora Andina S.A.');
      expect(screen.getByLabelText('Correo de la organización')).toHaveValue('ops@andina.com');
      expect(screen.queryByText('Organización creada correctamente')).not.toBeInTheDocument();
    });

    it('maps name and email 422 messages to their own fields', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValue(
        apiError(422, {
          message: 'invalid',
          errors: {
            name: ['La razón social no es válida'],
            email: ['El correo no puede superar 255 caracteres'],
          },
        }),
      );
      renderPage();
      await fillValid(user);

      await submit(user);

      await waitFor(() =>
        expect(screen.getByLabelText('Razón social')).toHaveAccessibleDescription(
          'La razón social no es válida',
        ),
      );
      expect(screen.getByLabelText('Correo de la organización')).toHaveAccessibleDescription(
        'El correo no puede superar 255 caracteres',
      );
    });

    it('shows the server message as a banner on a 403 and no success panel', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValue(apiError(403, { message: 'No autorizado' }));
      renderPage();
      await fillValid(user);

      await submit(user);

      expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado');
      expect(screen.getByLabelText('Razón social')).toHaveValue('Importadora Andina S.A.');
      expect(screen.queryByText('Organización creada correctamente')).not.toBeInTheDocument();
    });

    it('falls back to the generic banner when the failure has no server message', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValue(new Error('Network Error'));
      renderPage();
      await fillValid(user);

      await submit(user);

      expect(await screen.findByRole('alert')).toHaveTextContent(FALLBACK);
      expect(screen.getByLabelText('RUC')).toHaveValue('1790012345001');
    });

    it('clears a previous banner when the next attempt succeeds', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValueOnce(new Error('Network Error'));
      mockCreateOrganization.mockResolvedValueOnce(created());
      renderPage();
      await fillValid(user);
      await submit(user);
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await submit(user);

      expect(await screen.findByText('Organización creada correctamente')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('success panel', () => {
    async function createOrg() {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValue(created());
      renderPage();
      await fillValid(user);
      await submit(user);
      await screen.findByText('Organización creada correctamente');
      return user;
    }

    it('replaces the form with the organization name, RUC and both actions', async () => {
      await createOrg();

      expect(screen.getAllByText('Importadora Andina S.A.')).toHaveLength(2);
      expect(screen.getByText('RUC 1790012345001')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Seguir en modo personal' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Operar como Importadora Andina' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Razón social')).not.toBeInTheDocument();
    });

    it('navigates to the tenant area on Seguir en modo personal', async () => {
      const user = await createOrg();

      await user.click(screen.getByRole('button', { name: 'Seguir en modo personal' }));

      expect(screen.getByText('Panel del arrendatario')).toBeInTheDocument();
    });

    it('navigates to the tenant area on Operar como and persists no context', async () => {
      const user = await createOrg();

      await user.click(screen.getByRole('button', { name: 'Operar como Importadora Andina' }));

      expect(screen.getByText('Panel del arrendatario')).toBeInTheDocument();
      expect(localStorage).toHaveLength(0);
      expect(sessionStorage).toHaveLength(0);
      expect(mockCreateOrganization).toHaveBeenCalledTimes(1);
    });

    it('shows initials in the mark when the organization has no logo', async () => {
      await createOrg();

      expect(screen.getByText('IA')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('shows the logo image in the mark when the organization has one', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValue(
        created({ logo: 'http://localhost/storage/organization_logos/abc.png' }),
      );
      renderPage();
      await fillValid(user);
      await submit(user);

      expect(await screen.findByRole('img', { name: 'Logo de Importadora Andina S.A.' })).toHaveAttribute(
        'src',
        'http://localhost/storage/organization_logos/abc.png',
      );
      expect(screen.queryByText('IA')).not.toBeInTheDocument();
    });
  });

  describe('logo', () => {
    const png = () => new File(['x'], 'logo.png', { type: 'image/png' });
    const logoInput = () => screen.getByLabelText('Archivo del logo');

    it('shows the picker section with initials and no Quitar by default', async () => {
      const user = userEvent.setup();
      renderPage();

      expect(screen.getByText('Logo de la organización')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument();
      expect(
        screen.getByText('PNG o JPG, formato cuadrado. Opcional — si no, usamos las iniciales.'),
      ).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();

      await user.type(screen.getByLabelText('Razón social'), 'importadora andina');
      expect(screen.getByText('IA')).toBeInTheDocument();
    });

    it('sends the selected File as logo and shows the returned logo in the success panel', async () => {
      const user = userEvent.setup();
      const file = png();
      mockCreateOrganization.mockResolvedValue(
        created({ logo: 'http://localhost/storage/organization_logos/abc.png' }),
      );
      renderPage();
      await fillValid(user);
      await user.upload(logoInput(), file);

      await submit(user);

      await waitFor(() => expect(mockCreateOrganization).toHaveBeenCalledTimes(1));
      const sent = mockCreateOrganization.mock.calls[0][0].logo;
      expect(sent).toBeInstanceOf(File);
      expect(sent).toBe(file);
      expect(await screen.findByRole('img', { name: 'Logo de Importadora Andina S.A.' })).toBeInTheDocument();
    });

    it('rejects a wrong-type pick with the client message, selects nothing and sends no request', async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderPage();
      await fillValid(user);

      await user.upload(logoInput(), new File(['x'], 'logo.gif', { type: 'image/gif' }));

      expect(screen.getByText('El logo debe ser una imagen PNG o JPG')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    });

    it('rejects an oversize pick and a later valid pick clears the error', async () => {
      const user = userEvent.setup();
      renderPage();
      const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

      await user.upload(logoInput(), big);
      expect(screen.getByText('El logo no puede superar 2 MB')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();

      await user.upload(logoInput(), png());

      expect(screen.queryByText('El logo no puede superar 2 MB')).not.toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:logo.png');
    });

    it('sends no logo after Quitar', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValue(created());
      renderPage();
      await fillValid(user);
      await user.upload(logoInput(), png());
      await user.click(screen.getByRole('button', { name: 'Quitar' }));

      await submit(user);

      await waitFor(() => expect(mockCreateOrganization).toHaveBeenCalledTimes(1));
      expect(mockCreateOrganization.mock.calls[0][0].logo).toBeNull();
    });

    it('shows a server logo 422 under the picker, keeps values and selection, and retries without the logo', async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValueOnce(
        apiError(422, {
          message: 'invalid',
          errors: { logo: ['No se pudo cargar el logo. Intenta con otra imagen'] },
        }),
      );
      mockCreateOrganization.mockResolvedValueOnce(created());
      renderPage();
      await fillValid(user);
      await user.upload(logoInput(), png());

      await submit(user);

      expect(
        await screen.findByText('No se pudo cargar el logo. Intenta con otra imagen'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('RUC')).toHaveValue('1790012345001');
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:logo.png');
      expect(screen.queryByText('Organización creada correctamente')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Quitar' }));
      await submit(user);

      expect(await screen.findByText('Organización creada correctamente')).toBeInTheDocument();
      expect(mockCreateOrganization.mock.calls[1][0].logo).toBeNull();
    });
  });

  describe('cancel', () => {
    it('returns to the tenant area without sending a request', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.getByText('Panel del arrendatario')).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });
  });
});
