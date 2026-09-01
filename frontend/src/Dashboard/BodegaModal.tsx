import React, { useEffect, useState } from 'react';
import { X, CheckCircle, MapPin, Calendar, Building } from 'lucide-react';
import { getStoreRoomDetail, updateStoreRoom, type StoreRoomDetail } from '../services/storeRooms';


interface BodegaModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: number;
}



const BodegaModal: React.FC<BodegaModalProps> = ({ isOpen, onClose, storeId }) => {

    const [detalle, setDetalle] = useState<StoreRoomDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        const fetchDetalle = async () => {
            try {
                setLoading(true);
                const { data } = await getStoreRoomDetail(storeId);
                setDetalle(data);
            } catch (error) {
                console.error('Error cargando detalle de bodega', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetalle();
    }, [isOpen, storeId]);

    const handleGenerateContract = async () => {
        try {
            await updateStoreRoom(storeId, {
                publication_status: 'approved',
            });

            alert('Bodega aprobada y contrato generado');
            onClose();
        } catch (error) {
            console.error('Error aprobando bodega', error);
            alert('Error al aprobar la bodega');
        }
    }
    if (!isOpen) return null;

    if (loading || !detalle) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 shadow">
                    Cargando información de la bodega...
                </div>
            </div>
        );
    }

    function horaActual() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    const fecha = horaActual();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors flex mb-4">
                            <X size={24} />
                        </button>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="text-green-600 mt-1" size={24} />
                                <div className="flex-1">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                        Estado de la Solicitud
                                    </h2>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-gray-700 font-medium mb-1">
                                                Solicitud Aceptada
                                            </p>
                                            <p className="text-green-600 text-sm">
                                                Aceptada el {fecha}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600 mb-1">Próximo paso:</p>
                                            <p className="font-semibold text-gray-900">Generar contrato</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 rounded">
                                    <Building size={23} className='mt-[-5px] '></Building>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Detalles de la Bodega
                                </h3>
                            </div>

                            <div className="flex gap-4">
                                <img
                                    src={detalle.photos?.[0]}
                                    alt={detalle.title}
                                    className="w-24 h-24 rounded-lg object-cover"
                                />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-lg text-gray-900 mb-2">
                                        {detalle.title}
                                    </h4>

                                    <div className="flex items-start gap-2 text-gray-600 mb-2">
                                        <MapPin size={16} className="mt-1 flex-shrink-0" />
                                        <span className="text-sm">
                                            {detalle.direction}
                                        </span>
                                    </div>
                                    <div className="flex gap-4 text-sm text-gray-700">
                                        <span className="font-medium">{detalle.size} m²</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-5">
                            <div className="flex items-start gap-3 mb-4">
                                <Calendar className="text-gray-700 mt-1" size={24} />
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Detalles de la Reserva
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Precio Mensual</p>
                                        <p className="font-semibold text-green-600 text-lg">
                                            ${detalle.prices?.[0]?.price ?? '—'}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Valor Total</p>
                                        <p className="font-bold text-purple-600 text-xl">
                                            ${detalle.prices?.[0]?.price ?? '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">
                                Cerrar
                            </button>
                            <button
                                onClick={handleGenerateContract}
                                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
                            >
                                Generar Contrato
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        </div>
        /* sonarqube-enable */

    );
};

export default BodegaModal;