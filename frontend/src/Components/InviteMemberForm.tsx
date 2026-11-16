import { useId } from "react";

import { INVITATION_COPY } from "../utils/invitationCopy";
import { NOTICE_TONE, type InviteNotice, type NoticeTone } from "../utils/inviteNotice";

interface InviteMemberFormProps {
  organizationName: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  notice: InviteNotice | null;
}

const NOTICE_CLASS = {
  [NOTICE_TONE.SUCCESS]: "bg-green-50 border-green-200 text-green-700",
  [NOTICE_TONE.ERROR]: "bg-red-50 border-red-200 text-red-700",
} satisfies Record<NoticeTone, string>;

/**
 * Presentational invite form (hue-01 INV-W2). The container owns the value,
 * the client-side checks and the notice; this only renders them and reports
 * the submit, whether it came from the button or the Enter key.
 */
const InviteMemberForm = ({ organizationName, value, onChange, onSubmit, submitting, notice }: InviteMemberFormProps) => {
  const inputId = useId();
  const helperId = useId();

  return (
    <section>
      <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">{INVITATION_COPY.title}</h1>
      <p className="text-sm text-gray-500 m-0 mb-5">{INVITATION_COPY.subtitle(organizationName)}</p>

      <form
        className="bg-white rounded-xl border border-gray-200 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-2">
          {INVITATION_COPY.emailLabel}
        </label>
        <div className="flex flex-wrap items-start gap-3">
          <input
            id={inputId}
            type="text"
            inputMode="email"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={INVITATION_COPY.emailPlaceholder}
            aria-describedby={helperId}
            aria-invalid={notice?.tone === NOTICE_TONE.ERROR ? true : undefined}
            className="flex-1 min-w-60 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-leodega-600"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-leodega-600 text-white rounded-lg text-sm font-semibold border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? INVITATION_COPY.submitting : INVITATION_COPY.submit}
          </button>
        </div>

        {notice && (
          <div
            role={notice.tone === NOTICE_TONE.ERROR ? "alert" : "status"}
            className={`mt-4 rounded-lg border px-4 py-3 ${NOTICE_CLASS[notice.tone]}`}
          >
            <p className="text-sm font-semibold m-0">{notice.title}</p>
            {notice.body && <p className="text-sm text-gray-700 m-0 mt-1">{notice.body}</p>}
          </div>
        )}

        <p id={helperId} className="text-xs text-gray-500 m-0 mt-3">
          {INVITATION_COPY.helper}
        </p>
      </form>
    </section>
  );
};

export default InviteMemberForm;
