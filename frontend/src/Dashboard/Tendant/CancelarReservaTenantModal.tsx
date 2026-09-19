import type { TenantReservation } from "../../services/reservations";

interface CancelarReservaTenantModalProps {
  reservation: TenantReservation;
  onClose: () => void;
  onCancelled: (refundAmount: string) => void;
}

/**
 * sdd/tenant-reservations-screen: placeholder shell, fleshed out in the
 * dedicated Commit 4 work unit (preview fetch, verbatim prototype copy,
 * 409/403/404 handling). Exists now only so MisReservas (Commit 3) can wire
 * its "Cancelar reserva" click handler without a forward reference.
 */
const CancelarReservaTenantModal = ({ onClose }: CancelarReservaTenantModalProps) => (
  <div
    onClick={onClose}
    className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 px-4"
  >
    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6">
      <p>Cancelar reserva</p>
    </div>
  </div>
);

export default CancelarReservaTenantModal;
