import { useId } from "react";
import { Link } from "react-router-dom";

import { useOrganizationWallet, WALLET_STATUS } from "../hooks/useOrganizationWallet";
import { formatUSD } from "../utils/money";
import { PANEL_COPY } from "../utils/panelCopy";

interface PanelWalletSummaryProps {
  organizationId: number;
}

/**
 * Read-only balance of the organization wallet (hue-03 PAN-W6). It reuses the
 * existing wallet hook, so the balance follows wallet events, and offers only a
 * link to the wallet page: the panel never tops up. Loading and error stay in
 * this section so the rest of the page is unaffected.
 */
const PanelWalletSummary = ({ organizationId }: PanelWalletSummaryProps) => {
  const headingId = useId();
  const { status, balance } = useOrganizationWallet(organizationId);

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 id={headingId} className="m-0 text-base font-semibold text-gray-900">
            {PANEL_COPY.walletTitle}
          </h2>
          <p className="m-0 mt-1 text-sm text-gray-500">{PANEL_COPY.walletSubtitle}</p>
        </div>
        <Link
          to="/organizacion/billetera"
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 no-underline hover:bg-gray-50"
        >
          {PANEL_COPY.walletLink}
        </Link>
      </div>

      <div className="px-5 pb-5 pt-4">
        {status === WALLET_STATUS.LOADING && (
          <p role="status" className="m-0 text-sm text-gray-500">
            {PANEL_COPY.loading}
          </p>
        )}

        {status === WALLET_STATUS.ERROR && (
          <p role="alert" className="m-0 text-sm text-red-600">
            {PANEL_COPY.walletError}
          </p>
        )}

        {status === WALLET_STATUS.READY && balance !== null && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-leodega-700">
                {PANEL_COPY.walletBalanceLabel}
              </span>
              {Number(balance) === 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {PANEL_COPY.walletEmptyBadge}
                </span>
              )}
            </div>
            <p className="m-0 mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold leading-none text-gray-900">
                {formatUSD(balance, { fixed: true })}
              </span>
              <span className="text-sm font-medium text-gray-500">{PANEL_COPY.walletCurrency}</span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default PanelWalletSummary;
