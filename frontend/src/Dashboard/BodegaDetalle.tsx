import React, { useState, useEffect } from 'react';
import { MapPin, MoveLeft } from 'lucide-react';
import BodegaModal from './BodegaModal';
import { getStoreRoomDetail, type StoreRoomDetail } from '../services/storeRooms';

interface BodegaDetalleProps {
    bodega: { id: number };
    onVolver: () => void;
}



const BodegaDetalle: React.FC<BodegaDetalleProps> = ({ bodega, onVolver }) => {
    const [detalle, setDetalle] = useState<StoreRoomDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [, setActiveImage] = useState<string | null>(null);


    const securityLabels: Record<string, string> = {
        camara: 'Cámara de seguridad exterior',
        ruido: 'Monitor de ruido',
        control: 'Control de plagas y humedad',
        objetos: 'Restricción de objetos peligrosos',
    };

    const roomTypeLabels: Record<string, string> = {
        habitacion: 'Habitación',
        garaje: 'Garaje / Parqueadero',
        contenedor: 'Contenedor',
        sotano: 'Sótano',
        atico: 'Ático',
        bodega: 'Bodega independiente',
    };

    const storageTypeLabels: Record<string, string> = {
        completa: 'Bodega completa',
        privado: 'Espacio privado',
        compartido: 'Espacio compartido',
    };
    useEffect(() => {
        const fetchDetalle = async () => {
            try {
                const { data } = await getStoreRoomDetail(bodega.id);
                setDetalle(data);
                setActiveImage(data.photos?.[0] || null);

            } catch (error) {
                console.error('Error cargando detalles de bodega', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetalle();
    }, [bodega.id]);

    if (loading) {
        return <div className="p-6">Cargando detalle...</div>;
    }

    if (!detalle) {
        return <div className="p-6">No se pudo cargar la bodega</div>;
    }

    const securityData = detalle.security
        ? JSON.parse(detalle.security)
        : {};

    return (
        <div className="pl-8 pt-5 pr-8 bg-[#f5f6fa] min-h-screen">
            <div className="bg-white h-[470px] mb-6">
                {/* HEADER */}
                <div className="flex justify-between items-center px-4 pt-5 pb-4">
                    <div className="flex items-center gap-3 ml-2">
                        <button
                            onClick={onVolver}
                            className="hover:bg-gray-100 p-2 rounded-lg transition-colors"
                        >
                            <MoveLeft className="text-gray-700" size={24} />
                        </button>

                        <div className="bg-[#9441d8] h-10 w-10 rounded-lg flex items-center justify-center">
                            <h3 className="text-white font-semibold text-lg">L</h3>
                        </div>

                        <span className="text-lg font-medium">leodega</span>
                    </div>
                </div>

                {/* IMAGEN */}
                <div className="relative h-[400px] w-full">
                    <img
                        src={detalle.photos?.[0]}
                        alt={detalle.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-30"></div>

                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <div className="flex gap-2 mb-3">
                            <span className="bg-orange-500 text-sm font-medium px-3 py-1 rounded-full">
                                Espacio en Alquiler
                            </span>
                            <span className="bg-green-500 text-sm font-medium px-3 py-1 rounded-full">
                                Disponible
                            </span>
                        </div>

                        <h1 className="text-2xl font-bold mb-2">
                            {detalle.title}
                        </h1>

                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                                <MapPin size={16} />
                                <span>{detalle.city}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* INFO */}
            <div className="bg-white mb-6">
                <div className="flex justify-between items-start p-6 border-b border-gray-200">
                    <div>
                        <div className="flex items-baseline gap-2 mb-3">
                            <h2 className="text-4xl font-bold text-purple-600">
                                ${detalle.prices?.[0]?.price ?? '—'}
                            </h2>
                            <span className="text-gray-500 text-lg">/ USD mensual</span>
                        </div>

                        <div className="text-gray-600">
                            <span>{detalle.size} m²</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setMostrarModal(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                    >
                        Aprobar
                    </button>
                </div>

                {/* DESCRIPCIÓN */}
                <div className="p-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        Descripción
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                        {detalle.description}
                    </p>
                </div>

                <div className="p-6 border-t border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        Características
                    </h3>

                    <div className="grid grid-cols-2 gap-4">

                        {/* Tipo de espacio */}
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-green-500">✓</span>
                            <span>{roomTypeLabels[detalle.room_type]}</span>
                        </div>

                        {/* Tipo de almacenamiento */}
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-green-500">✓</span>
                            <span>{storageTypeLabels[detalle.storage_type]}</span>
                        </div>

                        {/* Tamaño */}
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-green-500">✓</span>
                            <span>{detalle.size} m² de espacio</span>
                        </div>

                        {/* Seguridad dinámica */}
                        {Object.entries(securityData)
                            .filter(([, value]) => value === true)
                            .map(([key]) => (
                                <div
                                    key={key}
                                    className="flex items-center gap-2 text-gray-700"
                                >
                                    <span className="text-green-500">✓</span>
                                    <span>{securityLabels[key]}</span>
                                </div>
                            ))}

                    </div>
                </div>

                {/* UBICACIÓN */}
                <div className="p-6 border-t border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        Ubicación
                    </h3>

                    <div className="flex items-start gap-2 text-gray-700">
                        <MapPin size={20} className="mt-1 text-purple-600" />
                        <div>
                            <p className="font-medium">{detalle.direction}</p>
                        </div>
                    </div>
                </div>

                {/* GALERÍA DE IMÁGENES */}
                {detalle.photos?.length > 1 && (
                    <div className="p-6 border-t border-gray-200">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4">
                            Más imágenes del espacio
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {detalle.photos.slice(1).map((photo: string, index: number) => (
                                <div
                                    key={index}
                                    className="overflow-hidden rounded-xl shadow hover:shadow-lg transition-shadow"
                                >
                                    <img
                                        src={photo}
                                        alt={`Imagen ${index + 2}`}
                                        className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            <BodegaModal
                isOpen={mostrarModal}
                onClose={() => setMostrarModal(false)}
                storeId={bodega.id}
            />
        </div>
    );
};

export default BodegaDetalle;
