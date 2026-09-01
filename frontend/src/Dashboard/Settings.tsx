import React, { useState } from 'react';
import { User, Bell, Lock, CreditCard, Shield, Menu } from 'lucide-react';
import PerfilTab from './Settings/PerfilTab';
import NotificacionesTab from './Settings/NotificacionesTab';
import SeguridadTab from './Settings/SeguridadTab';
import PagosTab from './Settings/PagosTab';
import PrivacidadTab from './Settings/PrivacidadTab';

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('perfil');
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const tabs = [
        { id: 'perfil', nombre: 'Perfil', icono: User },
        { id: 'notificaciones', nombre: 'Notificaciones', icono: Bell },
        { id: 'seguridad', nombre: 'Seguridad', icono: Lock },
        { id: 'pagos', nombre: 'Pagos', icono: CreditCard },
        { id: 'privacidad', nombre: 'Privacidad', icono: Shield },
    ];

    return (
        <div className="px-4 lg:pl-8 lg:pr-8 pt-5 bg-[#f5f6fa] min-h-screen">
            <div className="mb-6 mt-3">
                <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
                <p className="text-gray-600 mt-1">Administra tu cuenta y preferencias</p>
            </div>

            <div className="lg:hidden mb-4">
                <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 w-full justify-center"
                >
                    <Menu size={16} />
                    {showMobileMenu ? 'Ocultar Menú' : 'Mostrar Menú'}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className={`
                    ${showMobileMenu ? 'block' : 'hidden lg:block'}
                    w-full lg:w-64 bg-white rounded-lg shadow-sm p-4
                `}>
                    <nav className="space-y-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icono;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        if (window.innerWidth < 1024) {
                                            setShowMobileMenu(false);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id
                                        ? 'bg-purple-50 text-purple-600 font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span>{tab.nombre}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="flex-1 bg-white rounded-lg shadow-sm p-4 lg:p-6">
                    {activeTab === 'perfil' && <PerfilTab />}
                    {activeTab === 'notificaciones' && <NotificacionesTab />}
                    {activeTab === 'seguridad' && <SeguridadTab />}
                    {activeTab === 'pagos' && <PagosTab />}
                    {activeTab === 'privacidad' && <PrivacidadTab />}
                </div>
            </div>
        </div>
    );
};

export default Settings;
