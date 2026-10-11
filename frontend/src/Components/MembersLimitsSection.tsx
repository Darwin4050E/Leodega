import { useState } from "react";

import { SPENDING_LIMITS_STATUS, useSpendingLimits } from "../hooks/useSpendingLimits";
import type { SpendingLimitRow } from "../services/organizations";
import { formatUSD } from "../utils/money";
import { SPENDING_LIMIT_COPY } from "../utils/spendingLimitCopy";
import LimitModal from "./LimitModal";

interface MembersLimitsSectionProps {
  organizationId: number;
  isAdmin: boolean;
}

/**
 * Members of the organization with their monthly limit and what they have
 * consumed this month. The server already scopes the rows (an admin gets
 * every member, a member only their own), so the rows do not branch on the
 * role; only the edit control does.
 */
const MembersLimitsSection = ({ organizationId, isAdmin }: MembersLimitsSectionProps) => {
  const { status, rows, refresh } = useSpendingLimits(organizationId);
  const [editing, setEditing] = useState<SpendingLimitRow | null>(null);

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-gray-900 m-0 mb-3">{SPENDING_LIMIT_COPY.sectionTitle}</h2>

      {status === SPENDING_LIMITS_STATUS.LOADING && (
        <p className="text-sm text-gray-500 m-0">{SPENDING_LIMIT_COPY.loading}</p>
      )}

      {status === SPENDING_LIMITS_STATUS.ERROR && (
        <p className="text-sm text-red-600 m-0" role="alert">
          {SPENDING_LIMIT_COPY.loadError}
        </p>
      )}

      {status === SPENDING_LIMITS_STATUS.READY && rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{SPENDING_LIMIT_COPY.columnMember}</th>
                <th className="px-4 py-3 font-semibold">{SPENDING_LIMIT_COPY.columnLimit}</th>
                <th className="px-4 py-3 font-semibold">{SPENDING_LIMIT_COPY.columnSpent}</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.monthly_limit === null
                      ? SPENDING_LIMIT_COPY.noLimit
                      : formatUSD(row.monthly_limit, { fixed: true })}
                  </td>
                  <td className="px-4 py-3">{formatUSD(row.spent, { fixed: true })}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(row)}
                        className="text-sm font-semibold text-[#7551E9] bg-transparent border-none cursor-pointer"
                      >
                        {SPENDING_LIMIT_COPY.editLimit}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <LimitModal
          organizationId={organizationId}
          row={editing}
          onSaved={refresh}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
};

export default MembersLimitsSection;
