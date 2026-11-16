import { Link } from "react-router-dom";
import { useOrganizationWallet } from "../hooks/useOrganizationWallet";
import { formatUSD } from "../utils/money";

interface WalletBalanceChipProps {
  organizationId: number;
}

/**
 * OW-W1: balance of the active organization's wallet, visible to every
 * member. Rendered only when the balance is known: no placeholder while
 * loading and nothing on error, so the ribbon never shows a stale or zero
 * figure that could be mistaken for a real balance.
 */
const WalletBalanceChip = ({ organizationId }: WalletBalanceChipProps) => {
  const { balance } = useOrganizationWallet(organizationId);

  if (balance === null) return null;

  return (
    <Link
      to="/organizacion/billetera"
      className="ml-3 inline-flex items-center gap-1 rounded-full bg-white border border-leodega-200 px-3 py-0.5 text-xs font-semibold text-leodega-700"
    >
      Saldo <b>{formatUSD(balance, { fixed: true })}</b>
    </Link>
  );
};

export default WalletBalanceChip;
