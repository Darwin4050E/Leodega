import { useEffect, useState } from "react";

import HeaderTendant from "../../Components/HeaderTendant";
import WalletTopUpModal from "../../Components/WalletTopUpModal";
import { useActiveContext } from "../../context/useActiveContext";
import { useOrganizationWallet, WALLET_STATUS } from "../../hooks/useOrganizationWallet";
import { getWalletMovements, type WalletMovement, type WalletMovementType } from "../../services/organizations";
import { formatUSD } from "../../utils/money";
import { subscribeToWalletChanges } from "../../utils/walletEvents";

const MOVEMENT_LABEL: Record<WalletMovementType, string> = {
  recarga: "Recarga",
  reserva: "Reserva",
  reembolso: "Reembolso",
};

interface FetchedMovements {
  organizationId: number;
  movements: WalletMovement[] | null;
}

function formatSigned(amount: string): string {
  const sign = Number(amount) < 0 ? "-" : "+";
  return `${sign}${formatUSD(Math.abs(Number(amount)), { fixed: true })}`;
}

function formatMovementDate(createdAt: string): string {
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("es-EC");
}

/**
 * Container for the organization wallet screen: balance plus the movement
 * history. The server already scopes the history (admins see everything,
 * members only their own reservation rows), so the UI only changes the
 * heading and hides the top-up control for members.
 */
const BilleteraOrganizacion = () => {
  const { activeOrganization } = useActiveContext();
  const organizationId = activeOrganization?.id ?? null;
  const isAdmin = activeOrganization?.role === "admin";

  const { status: balanceStatus, balance } = useOrganizationWallet(organizationId);

  const [fetched, setFetched] = useState<FetchedMovements | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [topUpOpen, setTopUpOpen] = useState(false);

  useEffect(() => subscribeToWalletChanges(() => setRefreshCount((count) => count + 1)), []);

  useEffect(() => {
    if (organizationId === null) return;
    let cancelled = false;
    const settle = (movements: WalletMovement[] | null) => {
      if (!cancelled) setFetched({ organizationId, movements });
    };

    getWalletMovements(organizationId)
      .then((response) => settle(response.data))
      .catch(() => settle(null));

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshCount]);

  if (organizationId === null) {
    return (
      <>
        <HeaderTendant />
        <div className="px-8 py-7 bg-[#F5F6FA] min-h-screen">
          <p className="text-sm text-gray-500 m-0">Selecciona una organización para ver su billetera.</p>
        </div>
      </>
    );
  }

  // Tagged with the organization it belongs to so a stale list is never shown
  // for another organization while the next one loads.
  const current = fetched?.organizationId === organizationId ? fetched : null;
  const movements = current?.movements ?? null;
  const loadFailed = current !== null && movements === null;

  return (
    <>
      <HeaderTendant />
      <div className="px-8 py-7 bg-[#F5F6FA] min-h-screen">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Billetera de la organización</h1>
            <p className="text-sm text-gray-500 m-0">{activeOrganization?.name}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setTopUpOpen(true)}
              className="px-4.5 py-2.5 bg-[#7551E9] text-white rounded-lg text-sm font-semibold border-none"
            >
              Recargar saldo
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <p className="text-sm text-gray-500 m-0 mb-1">Saldo disponible</p>
          <p data-testid="wallet-balance" className="text-3xl font-bold text-gray-900 m-0">
            {balanceStatus === WALLET_STATUS.READY && balance !== null ? formatUSD(balance, { fixed: true }) : "—"}
          </p>
        </div>

        <h2 className="text-lg font-bold text-gray-900 m-0 mb-3">{isAdmin ? "Movimientos" : "Mis movimientos"}</h2>

        {loadFailed && (
          <p className="text-sm text-red-600 m-0" role="alert">
            No se pudieron cargar los movimientos.
          </p>
        )}

        {movements !== null && movements.length === 0 && (
          <p className="text-sm text-gray-500 m-0">Aún no hay movimientos.</p>
        )}

        {movements !== null && movements.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold">Saldo</th>
                  <th className="px-4 py-3 font-semibold">Realizado por</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">{formatMovementDate(movement.created_at)}</td>
                    <td className="px-4 py-3">{MOVEMENT_LABEL[movement.type]}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        Number(movement.amount) < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {formatSigned(movement.amount)}
                    </td>
                    <td className="px-4 py-3">{formatUSD(movement.balance_after, { fixed: true })}</td>
                    <td className="px-4 py-3">{movement.actor_name ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {topUpOpen && <WalletTopUpModal organizationId={organizationId} onClose={() => setTopUpOpen(false)} />}
    </>
  );
};

export default BilleteraOrganizacion;
