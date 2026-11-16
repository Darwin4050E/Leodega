interface OrganizationNoticeProps {
  name: string;
}

/**
 * HUE-05 OR-W1: presentational notice shown only while the active
 * organization context has resolved. The caller owns the resolved/visible
 * gate; this component just renders the fixed Spanish copy.
 */
export default function OrganizationNotice({ name }: OrganizationNoticeProps) {
  return (
    <p className="text-sm text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
      Reservando como <b>{name}</b>
    </p>
  );
}
