export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg'];

const LEGAL_SUFFIX = /\s+(S\.A\.|Cía\.|Ltda\.|C\.A\.).*$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUC_PATTERN = /^\d{13}$/;

export interface OrganizationFormValues {
  name: string;
  ruc: string;
  email: string;
}

export interface OrganizationFormErrors {
  name?: string;
  ruc?: string;
  email?: string;
  logo?: string;
}

export function organizationInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
  return (initials || 'OR').toUpperCase();
}

export function organizationShortName(name: string): string {
  return name.trim().replace(LEGAL_SUFFIX, '').trim();
}

export function validateOrganizationForm(values: OrganizationFormValues): OrganizationFormErrors {
  const errors: OrganizationFormErrors = {};
  const ruc = values.ruc.trim();

  if (!values.name.trim()) {
    errors.name = 'La razón social es obligatoria';
  }

  if (!ruc) {
    errors.ruc = 'El RUC es obligatorio';
  } else if (!RUC_PATTERN.test(ruc)) {
    errors.ruc = 'El RUC debe tener 13 dígitos';
  } else if (!ruc.endsWith('001')) {
    errors.ruc = 'El RUC debe terminar en 001';
  }

  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Ingresa un correo válido para la organización';
  }

  return errors;
}

export function validateLogoFile(file: File): string | null {
  if (!LOGO_MIME_TYPES.includes(file.type)) {
    return 'El logo debe ser una imagen PNG o JPG';
  }
  if (file.size > LOGO_MAX_BYTES) {
    return 'El logo no puede superar 2 MB';
  }
  return null;
}
