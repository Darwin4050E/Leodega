import { describe, it, expect } from 'vitest';
import {
  LOGO_MAX_BYTES,
  LOGO_MIME_TYPES,
  organizationInitials,
  organizationShortName,
  validateLogoFile,
  validateOrganizationForm,
} from './organization';

const VALID_FORM = { name: 'Importadora Andina S.A.', ruc: '1790012345001', email: 'ops@andina.com' };

function fileOf(type: string, size = 10) {
  return new File([new Uint8Array(size)], 'logo', { type });
}

describe('organizationInitials', () => {
  it('uses the first letter of the first two words, uppercased', () => {
    expect(organizationInitials('Importadora Andina S.A.')).toBe('IA');
    expect(organizationInitials('  oriente   logistica  ')).toBe('OL');
  });

  it('uses a single letter for a one-word name', () => {
    expect(organizationInitials('Acme')).toBe('A');
  });

  it('falls back to OR when the name is empty or blank', () => {
    expect(organizationInitials('')).toBe('OR');
    expect(organizationInitials('   ')).toBe('OR');
  });
});

describe('organizationShortName', () => {
  it('strips a trailing legal suffix and everything after it', () => {
    expect(organizationShortName('Importadora Andina S.A.')).toBe('Importadora Andina');
    expect(organizationShortName('Acme Cía. Ltda.')).toBe('Acme');
    expect(organizationShortName('Norte ltda. en liquidación')).toBe('Norte');
  });

  it('keeps names without a legal suffix, trimmed', () => {
    expect(organizationShortName('  Acme  ')).toBe('Acme');
    expect(organizationShortName('Oriente Logística')).toBe('Oriente Logística');
  });

  it('returns an empty string for an empty name', () => {
    expect(organizationShortName('')).toBe('');
  });

  it('keeps a name that is only a suffix because the suffix needs a leading word', () => {
    expect(organizationShortName('S.A.')).toBe('S.A.');
  });
});

describe('validateOrganizationForm', () => {
  it('returns no errors for a valid form', () => {
    expect(validateOrganizationForm(VALID_FORM)).toEqual({});
  });

  it('requires the razón social', () => {
    expect(validateOrganizationForm({ ...VALID_FORM, name: '   ' })).toEqual({
      name: 'La razón social es obligatoria',
    });
  });

  it('requires the RUC', () => {
    expect(validateOrganizationForm({ ...VALID_FORM, ruc: '' })).toEqual({
      ruc: 'El RUC es obligatorio',
    });
  });

  it.each(['123', '12345678901234', '179001234500a'])('rejects RUC %s as not 13 digits', (ruc) => {
    expect(validateOrganizationForm({ ...VALID_FORM, ruc })).toEqual({
      ruc: 'El RUC debe tener 13 dígitos',
    });
  });

  it('rejects a 13-digit RUC that does not end in 001', () => {
    expect(validateOrganizationForm({ ...VALID_FORM, ruc: '1790012345002' })).toEqual({
      ruc: 'El RUC debe terminar en 001',
    });
  });

  it.each(['', 'abc', 'a@b', 'a b@c.com'])('rejects email "%s"', (email) => {
    expect(validateOrganizationForm({ ...VALID_FORM, email })).toEqual({
      email: 'Ingresa un correo válido para la organización',
    });
  });

  it('reports every invalid field together', () => {
    expect(validateOrganizationForm({ name: '', ruc: '123', email: 'abc' })).toEqual({
      name: 'La razón social es obligatoria',
      ruc: 'El RUC debe tener 13 dígitos',
      email: 'Ingresa un correo válido para la organización',
    });
  });
});

describe('validateLogoFile', () => {
  it('exposes the accepted types and the 2 MB limit', () => {
    expect(LOGO_MIME_TYPES).toEqual(['image/png', 'image/jpeg']);
    expect(LOGO_MAX_BYTES).toBe(2 * 1024 * 1024);
  });

  it.each(['image/png', 'image/jpeg'])('accepts %s', (type) => {
    expect(validateLogoFile(fileOf(type))).toBeNull();
  });

  it.each(['image/gif', 'image/webp', 'application/pdf', ''])(
    'rejects type "%s" as not PNG or JPG',
    (type) => {
      expect(validateLogoFile(fileOf(type))).toBe('El logo debe ser una imagen PNG o JPG');
    },
  );

  it('accepts a file of exactly 2 MB', () => {
    expect(validateLogoFile(fileOf('image/png', LOGO_MAX_BYTES))).toBeNull();
  });

  it('rejects a file of 2 MB plus one byte', () => {
    expect(validateLogoFile(fileOf('image/png', LOGO_MAX_BYTES + 1))).toBe(
      'El logo no puede superar 2 MB',
    );
  });
});
