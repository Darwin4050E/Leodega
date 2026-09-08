import React from "react";
import type { ActivityEntry, Action } from "../../services/dashboard";

/**
 * The API returns machine `action`/`tone` values; this component owns the
 * Spanish label map (per addendum #195 item 4), mirroring `REASON_LABEL`
 * from #187's moderation screen.
 */
const ACTION_LABEL: Record<Action, string> = {
  approved: "aprobó",
  rejected: "rechazó",
  blocked: "bloqueó la cuenta",
  reactivated: "reactivó la cuenta",
};

interface ActivityFeedProps {
  readonly entries: ActivityEntry[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ entries }) => {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">Sin actividad reciente.</p>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3 items-start">
          <span
            className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
              entry.tone === "ok" ? "bg-violet-600" : "bg-red-600"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 leading-snug">
              <strong className="text-gray-900 font-semibold">{entry.actor ?? "Administrador"}</strong>{" "}
              {ACTION_LABEL[entry.action]} {entry.target}
            </p>
            {entry.note && <p className="text-xs text-gray-400 mt-0.5">{entry.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
