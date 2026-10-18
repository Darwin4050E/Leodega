import { Link } from 'react-router-dom';
import { useActiveContext } from '../context/useActiveContext';
import { PANEL_COPY } from '../utils/panelCopy';
import WalletBalanceChip from './WalletBalanceChip';

const ActiveContextRibbon = () => {
  const { enabled, activeOrganization } = useActiveContext();

  if (!enabled || !activeOrganization) return null;

  return (
    <div
      role="status"
      className="bg-leodega-50 border-b border-leodega-200 text-leodega-700 text-sm px-12 py-2 text-center"
    >
      Estás operando como <b>{activeOrganization.name}</b>
      <WalletBalanceChip organizationId={activeOrganization.id} />
      <Link
        to="/organizacion/panel"
        className="ml-3 inline-flex items-center rounded-full bg-white border border-leodega-200 px-3 py-0.5 text-xs font-semibold text-leodega-700"
      >
        {PANEL_COPY.ribbonLink}
      </Link>
    </div>
  );
};

export default ActiveContextRibbon;
