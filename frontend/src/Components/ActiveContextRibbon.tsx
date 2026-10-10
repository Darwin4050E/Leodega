import { useActiveContext } from '../context/useActiveContext';
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
    </div>
  );
};

export default ActiveContextRibbon;
