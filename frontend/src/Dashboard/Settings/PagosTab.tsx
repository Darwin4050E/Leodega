import React from 'react';
import { CreditCard } from 'lucide-react';

const PagosTab: React.FC = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Métodos de Pago</h2>
                <p className="text-gray-600 mb-6">Administra cómo recibes tus pagos</p>

                <button className="mb-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm lg:text-base w-full sm:w-auto">
                    + Agregar Cuenta Bancaria
                </button>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <CreditCard size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600">No tienes métodos de pago configurados</p>
                    <p className="text-sm text-gray-500 mt-1">Agrega una cuenta bancaria para recibir pagos</p>
                </div>
            </div>
        </div>
    );
};

export default PagosTab;
