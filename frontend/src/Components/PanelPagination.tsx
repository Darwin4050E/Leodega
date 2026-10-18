import { INVITATION_COPY } from "../utils/invitationCopy";

interface PanelPaginationProps {
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
}

const PAGE_BUTTON_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

/** Previous/next controls shared by the paged panel sections; absent when there is one page. */
const PanelPagination = ({ page, lastPage, onPageChange }: PanelPaginationProps) => {
  if (lastPage <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-3 px-5 py-4">
      <button type="button" className={PAGE_BUTTON_CLASS} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {INVITATION_COPY.previousPage}
      </button>
      <span className="text-sm text-gray-600">{INVITATION_COPY.pageOf(page, lastPage)}</span>
      <button
        type="button"
        className={PAGE_BUTTON_CLASS}
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      >
        {INVITATION_COPY.nextPage}
      </button>
    </nav>
  );
};

export default PanelPagination;
