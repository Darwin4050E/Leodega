import React, { useState } from 'react';

const NotificacionesTab: React.FC = () => {
    const [notificaciones, setNotificaciones] = useState({
        emailReservas: true,
        emailMensajes: true,
        pushReservas: true,
        pushMensajes: false,
        emailReportes: true,
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferencias de Notificaciones</h2>
                <p className="text-gray-600 mb-6">Elige cómo quieres recibir notificaciones</p>

                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b gap-3">
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900 text-sm lg:text-base">Notificaciones de Reservas por Email</h3>
                            <p className="text-sm text-gray-500">Recibe emails cuando alguien reserva tu bodega</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notificaciones.emailReservas}
                                onChange={(e) => setNotificaciones({ ...notificaciones, emailReservas: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b gap-3">
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900 text-sm lg:text-base">Notificaciones Push de Reservas</h3>
                            <p className="text-sm text-gray-500">Recibe notificaciones push instantáneas</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notificaciones.pushReservas}
                                onChange={(e) => setNotificaciones({ ...notificaciones, pushReservas: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b gap-3">
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900 text-sm lg:text-base">Mensajes de Usuarios por Email</h3>
                            <p className="text-sm text-gray-500">Recibe emails cuando te envíen mensajes</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notificaciones.emailMensajes}
                                onChange={(e) => setNotificaciones({ ...notificaciones, emailMensajes: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b gap-3">
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900 text-sm lg:text-base">Reportes Mensuales</h3>
                            <p className="text-sm text-gray-500">Resumen de tus bodegas y ganancias</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notificaciones.emailReportes}
                                onChange={(e) => setNotificaciones({ ...notificaciones, emailReportes: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificacionesTab;
