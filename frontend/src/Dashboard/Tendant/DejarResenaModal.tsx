import { useState } from "react";
import { Star } from "lucide-react";

import { rateStoreRoom } from "../../services/ratings";
import { asApiError } from "../../api/errors";
import type { TenantReservation } from "../../services/reservations";

interface DejarResenaModalProps {
  reservation: TenantReservation;
  onClose: () => void;
  /** The review was saved; the parent closes the modal and thanks the user. */
  onReviewed: () => void;
}

const GENERIC_ERROR = "No se pudo publicar tu reseña. Inténtalo de nuevo.";

/**
 * Review modal for a finished reservation. Copy follows ResReviewForm
 * (PrototipoLeodega-main/js/TenantReservasPage.jsx:51-71). Posts through the
 * same service as the catalog's "Calificar" (POST /ratings), which links the
 * rating to the storeroom and the authenticated user: one review per
 * storeroom, so a repeat is answered with 409.
 */
const DejarResenaModal = ({ reservation, onClose, onReviewed }: DejarResenaModalProps) => {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const title = reservation.store_rooms?.title ?? "Bodega";
  const ready = stars > 0 && text.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError("");
    try {
      await rateStoreRoom({
        store_id: reservation.store_room_id,
        stars,
        comment: text.trim(),
      });
      onReviewed();
    } catch (err: unknown) {
      const apiError = asApiError(err);
      setError(apiError.response?.data?.message || GENERIC_ERROR);
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2200] bg-gray-900/55 flex items-center justify-center p-5"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dejar reseña"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6">
          <h4 className="text-lg font-bold text-gray-900 m-0 mb-0.5">Dejar reseña</h4>
          <p className="text-xs text-gray-500 m-0">{title}</p>
        </div>
        <div className="px-6 pt-4">
          <p className="text-sm font-semibold text-gray-900 m-0 mb-2.5">¿Cómo fue tu experiencia?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={n === 1 ? "1 estrella" : `${n} estrellas`}
                onClick={() => setStars(n)}
                className="p-0.5 bg-transparent border-none"
              >
                <Star
                  size={26}
                  color="#FFA500"
                  className={n <= stars ? "fill-current text-[#FFA500]" : ""}
                />
              </button>
            ))}
          </div>
          <label htmlFor="review-text" className="block text-xs font-semibold text-gray-700 mt-3 mb-1.5">
            Tu reseña
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Cuéntanos sobre la bodega, el acceso, el gestor…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-y"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600 mt-2 mb-0">
              {error}
            </p>
          )}
        </div>
        <div className="px-6 pt-4 pb-5 flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!ready}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              ready ? "bg-[#7551E9] text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Publicar reseña
          </button>
        </div>
      </div>
    </div>
  );
};

export default DejarResenaModal;
