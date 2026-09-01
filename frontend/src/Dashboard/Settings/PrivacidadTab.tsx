import React from 'react';
import { useNavigate } from "react-router-dom";
import { deleteAccount } from '../../services/profile';
import { asApiError } from '../../api/errors';

const PrivacidadTab: React.FC = () => {
    const navigate = useNavigate();
    const handleBorrarCuenta = async () => {
        const ok = window.confirm("¿Seguro? Esta acción es permanente y no se puede deshacer.");
        if (!ok) return;

        try {
            await deleteAccount();
            localStorage.clear();
            alert("Cuenta eliminada correctamente");
            navigate("/login");
        } catch (e: unknown) {
            console.error(e);
            alert(asApiError(e).response?.data?.message || "No se pudo eliminar la cuenta");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacidad y Datos</h2>

                <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-2">Visibilidad del Perfil</h3>
                        <p className="text-sm text-gray-500 mb-4">Controla quién puede ver tu información</p>
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm lg:text-base">
                            <option>Público</option>
                            <option>Solo usuarios registrados</option>
                            <option>Privado</option>
                        </select>
                    </div>

                    {/* SE NECESITA UNA LIBRERIA PARA ESTO
                    <div className="border rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-2">Descargar mis Datos</h3>
                        <p className="text-sm text-gray-500 mb-4">Obtén una copia de tu información</p>
                        <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm lg:text-base w-full sm:w-auto">
                            Solicitar Datos
                        </button>
                    </div>
                    */}

                    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <h3 className="font-medium text-red-900 mb-2">Eliminar Cuenta</h3>
                        <p className="text-sm text-red-600 mb-4">Esta acción es permanente y no se puede deshacer</p>
                        <button
                            onClick={handleBorrarCuenta}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm lg:text-base w-full sm:w-auto"
                        >
                            Eliminar Cuenta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacidadTab;
