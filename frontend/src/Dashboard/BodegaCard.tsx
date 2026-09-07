import { useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { deleteStoreRoom } from "../services/storeRooms";
import { asApiError } from "../api/errors";
import EliminarBodegaModal from "./EliminarBodegaModal";

interface StorePrice {
    mode: string;
    price: number;
    disponibility: boolean;
}

interface BodegaCardProps {
    id: number;
    title: string;
    direction: string;
    city: string;
    size: string;
    publication_status: string;
    storage_type: string;
    room_type: string;
    image?: string;
    storePrices?: StorePrice[];
    active_reservations_count?: number;
    onDeleted?: (id: number, status: "deleted" | "not_found") => void;
}

const BodegaCard = ({
    id,
    title,
    image,
    storePrices = [],
    active_reservations_count = 0,
    onDeleted,
}: BodegaCardProps) => {
    const defaultImage =
        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop";

    const navigate = useNavigate();
    const price = storePrices.length > 0 ? storePrices[0].price : null;
    const numericPrice = Number(price);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");

    const canDelete = active_reservations_count === 0;
    const tooltip = canDelete
        ? undefined
        : `No se puede eliminar: tiene ${active_reservations_count} reserva(s) activa(s) o futura(s).`;

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        setErrorMessage("");

        try {
            await deleteStoreRoom(id);
            setShowDeleteModal(false);
            onDeleted?.(id, "deleted");
        } catch (error) {
            const apiError = asApiError(error);
            const status = apiError.response?.status;

            if (status === 404) {
                setShowDeleteModal(false);
                onDeleted?.(id, "not_found");
                return;
            }

            setErrorMessage(
                apiError.response?.data?.message || "Ocurrió un error al eliminar la bodega."
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="relative h-48 overflow-hidden">
                <img
                    src={image || defaultImage}
                    alt={title}
                    className="w-full h-48 object-cover"
                />
            </div>

            <div className="p-4">

                <h3 className="text-[18px] font-medium text-gray-900">{title}</h3>

                <p className="text-[16px] font-medium text-blue-600">


                    {
                        Number.isFinite(numericPrice) ? `$${numericPrice.toFixed(2)}` : "Sin precio"}
                </p>

                <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center text-yellow-400 text-lg">
                        {[...Array(5)].map((_, i) => (
                            <span key={i}>★</span>
                        ))}
                    </div>
                    <span className="text-sm text-gray-500">(63)</span>
                </div>

                {errorMessage && (
                    <p className="text-xs text-red-600 mb-2">{errorMessage}</p>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(`/leodega/${id}`)}
                        className="text-[11px] px-6 bg-[#ebf0fa] text-black py-2.5 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                        Ver Bodega
                    </button>

                    <button
                        onClick={() => canDelete && setShowDeleteModal(true)}
                        disabled={!canDelete}
                        title={tooltip}
                        aria-label="Eliminar"
                        className={`flex items-center gap-1 text-[11px] px-3 py-2.5 rounded-lg font-medium transition-colors ${canDelete
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                    >
                        {canDelete ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        Eliminar
                    </button>
                </div>
            </div>

            {showDeleteModal && (
                <EliminarBodegaModal
                    title={title}
                    isDeleting={isDeleting}
                    onCancel={() => setShowDeleteModal(false)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </div>
    );
};

export default BodegaCard;
