export const ACTIVE_CONTEXT_COPY = {
  title: '¿Cómo quieres operar?',
  subtitle: 'Elige a nombre de quién quieres operar. Podrás cambiarlo luego.',
  personalName: 'Modo personal',
  personalSub: 'Reservas a tu nombre',
  roleAdmin: 'Administrador',
  roleMember: 'Miembro',
  logoAlt: (name: string) => `Logo de ${name}`,
  loading: 'Cargando organizaciones…',
  error: 'No pudimos cargar tus organizaciones',
  retry: 'Reintentar',
  back: 'Volver',
} as const
