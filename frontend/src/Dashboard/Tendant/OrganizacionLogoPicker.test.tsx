import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OrganizacionLogoPicker from './OrganizacionLogoPicker';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const mockCreateObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
const mockRevokeObjectURL = vi.fn();

const png = (name = 'logo.png') => new File(['x'], name, { type: 'image/png' });

function Harness({ initials = 'OR', error }: { initials?: string; error?: string }) {
  const [file, setFile] = useState<File | null>(null);
  return <OrganizacionLogoPicker file={file} initials={initials} error={error} onChange={setFile} />;
}

function fileInput() {
  return screen.getByLabelText('Archivo del logo') as HTMLInputElement;
}

describe('OrganizacionLogoPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows the label, initials, upload button and helper text when no file is selected', () => {
    render(<Harness initials="IA" />);

    expect(screen.getByText('Logo de la organización')).toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument();
    expect(
      screen.getByText('PNG o JPG, formato cuadrado. Opcional — si no, usamos las iniciales.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('only accepts PNG and JPEG files in the hidden input', () => {
    render(<Harness />);

    expect(fileInput()).toHaveAttribute('accept', 'image/png,image/jpeg');
  });

  it('follows the initials prop as the name changes', () => {
    const { rerender } = render(
      <OrganizacionLogoPicker file={null} initials="IA" onChange={() => {}} />,
    );
    expect(screen.getByText('IA')).toBeInTheDocument();

    rerender(<OrganizacionLogoPicker file={null} initials="OR" onChange={() => {}} />);

    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.queryByText('IA')).not.toBeInTheDocument();
  });

  it('shows a preview, Cambiar foto and Quitar after a file is picked', async () => {
    const user = userEvent.setup();
    render(<Harness initials="IA" />);

    await user.upload(fileInput(), png());

    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:logo.png');
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subir foto' })).not.toBeInTheDocument();
    expect(screen.queryByText('IA')).not.toBeInTheDocument();
  });

  it('replaces the preview and revokes the previous object URL when another file is picked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(fileInput(), png('first.png'));

    await user.upload(fileInput(), png('second.png'));

    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:second.png');
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:first.png');
    expect(mockRevokeObjectURL).not.toHaveBeenCalledWith('blob:second.png');
  });

  it('restores initials and Subir foto on Quitar and revokes the object URL', async () => {
    const user = userEvent.setup();
    render(<Harness initials="IA" />);
    await user.upload(fileInput(), png());

    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:logo.png');
  });

  it('revokes the object URL when it unmounts with a file selected', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.upload(fileInput(), png());
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:logo.png');
  });

  it('does not create an object URL while no file is selected', () => {
    render(<Harness />);

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('shows the error message under the picker and keeps Cambiar foto and Quitar usable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <OrganizacionLogoPicker
        file={png()}
        initials="OR"
        error="El logo no puede superar 2 MB"
        onChange={onChange}
      />,
    );

    expect(screen.getByText('El logo no puede superar 2 MB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeEnabled();
  });
});
