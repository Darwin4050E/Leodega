import React from "react";

interface MetricCardProps {
  readonly label: string;
  readonly value: number;
  readonly accent?: boolean;
  readonly sub?: string;
  readonly secondaryLabel?: string;
  readonly secondaryValue?: number;
}

/**
 * Presentational metric card matching the prototype's `ADMetric`
 * (`AdminPanel.jsx:642-648`). The accounts panel uses the optional
 * secondary value/label to render one panel with two values (usuarios +
 * bloqueadas) side by side, per design #197 — not two separate cards.
 */
const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  accent = false,
  sub,
  secondaryLabel,
  secondaryValue,
}) => {
  const hasSecondary = secondaryLabel !== undefined && secondaryValue !== undefined;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>

      {hasSecondary ? (
        <div className="flex gap-6 mt-3">
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">Usuarios</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{secondaryValue}</p>
            <p className="text-xs text-gray-400 mt-0.5">{secondaryLabel}</p>
          </div>
        </div>
      ) : (
        <p className={`text-3xl font-bold tracking-tight mt-3 ${accent ? "text-violet-600" : "text-gray-900"}`}>
          {value}
        </p>
      )}

      {sub && <p className={`text-xs mt-1.5 font-medium ${accent ? "text-violet-600" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
};

export default MetricCard;
