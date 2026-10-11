import { formatUSD } from "../../utils/money";

interface RefundBreakdownProps {
  totalAmount: string;
  penaltyAmount: string;
  refundAmount: string;
  organizationName: string;
}

interface BreakdownLineProps {
  label: string;
  amount: string;
  strong?: boolean;
}

const BreakdownLine = ({ label, amount, strong = false }: BreakdownLineProps) => (
  <div className={`flex justify-between text-sm ${strong ? "font-bold text-gray-900" : "text-gray-600"}`}>
    <span>{label}</span>
    <span>{formatUSD(amount, { fixed: true })}</span>
  </div>
);

/**
 * Presentational three-line refund box for the org admin cancel modal
 * (HUE-06 OR-W9). Amounts come straight from the cancellation preview.
 */
const RefundBreakdown = ({ totalAmount, penaltyAmount, refundAmount, organizationName }: RefundBreakdownProps) => {
  const hasRefund = Math.round(Number(refundAmount) * 100) > 0;

  return (
    <div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <BreakdownLine label="Total pagado" amount={totalAmount} />
        <BreakdownLine label="Penalización" amount={penaltyAmount} />
        <BreakdownLine label="Reembolso" amount={refundAmount} strong />
      </div>
      <p className="text-sm text-gray-700 mt-3 mb-0">
        {hasRefund ? (
          <>
            El reembolso de <b className="text-gray-900">{formatUSD(refundAmount, { suffix: true })}</b> se
            acreditará al saldo de {organizationName}.
          </>
        ) : (
          "Esta cancelación no genera reembolso."
        )}
      </p>
    </div>
  );
};

export default RefundBreakdown;
