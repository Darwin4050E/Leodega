import { Check, ChevronDown, Plus, User } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { CONTEXT_KIND } from '../utils/activeContext';
import { ORGANIZATIONS_STATUS } from '../context/activeContextBase';
import { useActiveContext } from '../context/useActiveContext';
import {
  organizationInitials,
  organizationRoleLabel,
  organizationShortName,
} from '../utils/organization';
import type { Organization } from '../services/organizations';

interface ContextSwitcherProps {
  placement: 'header' | 'drawer';
}

const ROW_CLASSES =
  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-leodega-50 focus-visible:bg-leodega-50 focus-visible:outline-none';

function OrganizationAvatar({ organization }: { organization: Organization }) {
  if (organization.logo) {
    return (
      <img
        src={organization.logo}
        alt={`Logo de ${organization.name}`}
        className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leodega-50 text-xs font-semibold text-leodega-700">
      {organizationInitials(organization.name)}
    </div>
  );
}

const ContextSwitcher = ({ placement }: ContextSwitcherProps) => {
  const {
    context,
    activeOrganization,
    organizations,
    status,
    enabled,
    selectOrganization,
    selectPersonal,
    reloadOrganizations,
  } = useActiveContext();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  if (!enabled) return null;

  const isPersonal = context.kind === CONTEXT_KIND.PERSONAL;
  const triggerLabel = isPersonal
    ? 'Modo personal'
    : activeOrganization
      ? organizationShortName(activeOrganization.name)
      : 'Cargando…';

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choosePersonal = () => {
    selectPersonal();
    setOpen(false);
  };

  const chooseOrganization = (organizationId: number) => {
    selectOrganization(organizationId);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      data-testid="context-switcher"
      data-placement={placement}
      onKeyDown={onKeyDown}
      className={placement === 'drawer' ? 'relative w-full max-w-xs' : 'relative'}
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="context-switcher-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-leodega-200 bg-white px-3 py-2 text-sm font-medium text-leodega-700 hover:bg-leodega-50"
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Cambiar contexto"
          className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={choosePersonal}
            aria-current={isPersonal ? 'true' : undefined}
            className={ROW_CLASSES}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leodega-50 text-leodega-700">
              <User size={16} />
            </div>
            <span className="flex-1 font-medium text-gray-900">Modo personal</span>
            {isPersonal && <Check size={16} className="text-leodega-600" />}
          </button>

          {organizations.map((organization) => {
            const isActive =
              context.kind === CONTEXT_KIND.ORGANIZATION &&
              context.organizationId === organization.id;
            return (
              <button
                key={organization.id}
                type="button"
                onClick={() => chooseOrganization(organization.id)}
                aria-current={isActive ? 'true' : undefined}
                className={ROW_CLASSES}
              >
                <OrganizationAvatar organization={organization} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{organization.name}</span>
                  <span className="block text-xs text-gray-500">
                    {organizationRoleLabel(organization.role)}
                  </span>
                </span>
                {isActive && <Check size={16} className="text-leodega-600" />}
              </button>
            );
          })}

          {status === ORGANIZATIONS_STATUS.LOADING && (
            <p className="px-3 py-2 text-xs text-gray-500">Cargando organizaciones…</p>
          )}
          {status === ORGANIZATIONS_STATUS.ERROR && (
            <div className="px-3 py-2 text-xs text-gray-600">
              <p>No pudimos cargar tus organizaciones</p>
              <button
                type="button"
                onClick={reloadOrganizations}
                className="mt-1 font-semibold text-leodega-700 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          <div className="my-1 border-t border-gray-200" />
          <Link
            to="/mi-cuenta/crear-organizacion"
            onClick={() => setOpen(false)}
            className={`${ROW_CLASSES} font-medium text-leodega-700`}
          >
            <Plus size={16} />
            Crear organización
          </Link>
        </div>
      )}
    </div>
  );
};

export default ContextSwitcher;
