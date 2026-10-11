/**
 * Spanish copy of the member spending-limit UI (spec strings ML-ES*), kept in
 * one place so rewording a confirmed string is a one-line change. Entries are
 * added as the screens that use them are built.
 */
export const SPENDING_LIMIT_COPY = {
  sectionTitle: "Miembros y límites",
  columnMember: "Miembro",
  columnLimit: "Límite mensual",
  columnSpent: "Consumido este mes",
  noLimit: "Sin límite",
  loading: "Cargando miembros…",
  loadError: "No pudimos cargar los miembros",
  editLimit: "Editar límite",
  modalTitle: (name: string) => `Límite mensual de ${name}`,
  fieldLabel: "Límite mensual (USD)",
  save: "Guardar",
  saving: "Guardando...",
  cancel: "Cancelar",
  lowLimitWarning: (consumed: string) =>
    `Este miembro ya consumió ${consumed} este mes. Con este límite no podrá crear nuevas reservas que empiecen este mes.`,
  invalidLimit: "El límite mensual debe ser un monto mayor que 0, con hasta 6 dígitos enteros y 2 decimales",
  startMonthHelp: "El costo total de cada reserva cuenta en el mes en que empieza.",
  saveError: "No se pudo guardar el límite. Intenta nuevamente.",
} as const;
