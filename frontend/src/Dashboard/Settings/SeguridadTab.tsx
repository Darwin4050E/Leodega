import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { changePassword, getSessions, deleteSession } from '../../services/profile';
import { asApiError } from '../../api/errors';

interface Session {
    id: number;
    user_agent?: string;
    ip_address?: string;
    is_current: boolean;
    last_used_at?: string;
}

const SeguridadTab: React.FC = () => {
    const [passwordF, setPasswordF] = useState({
        actual_p: "",
        new_p: "",
        new_p_c: "",
    });
    const [passMsg, setPassMsg] = useState<string>("");
    // passErrors se calcula y guarda pero nunca se renderiza en el JSX —ya era
    // así antes de dividir Settings.tsx en tabs (Fase 4c), se preserva tal
    // cual, no es parte de esta limpieza de lint agregar la UI que falta.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [passErrors, setPassErrors] = useState<{
        actual_p?: string;
        new_p?: string;
        new_p_c?: string;
    }>({});


    const [passLoading, setPassLoading] = useState(false);

    const handleActualizarPassword = async () => {
        setPassMsg("");
        setPassErrors({});
        try {
            setPassLoading(true);
            console.log("ENVIANDO:", passwordF);

            await changePassword(passwordF);
            setPasswordF({
                actual_p: "",
                new_p: "",
                new_p_c: "",
            });
        } catch (error: unknown) {
            const data = asApiError(error).response?.data;
            const errs = data?.errors || {};
            setPassErrors({
                actual_p: errs.actual_p?.[0],
                new_p: errs.new_p?.[0],
                new_p_c: errs.new_p_c?.[0],
            });
        } finally {
            setPassLoading(false);
        }
    };

    // SESIONES ACTIVAS
    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsMsg, setSessionsMsg] = useState<{ type: "success" | "error" | ""; text: string }>({
        type: "",
        text: "",
    });
    const handleSession = async () => {
        try {
            setSessionsLoading(true);
            setSessionsMsg({ type: "", text: "" });
            const { data } = await getSessions();
            setSessions(data.sessions ?? []);
        } catch (error) {
            console.error("Error cargando sesiones:", error);
        } finally {
            setSessionsLoading(false);
        }
    };

    // Antes esto vivía en el padre, atado a `activeTab === "seguridad"`; como
    // este componente solo se monta cuando esa pestaña está activa, cargar al
    // montar reproduce exactamente el mismo comportamiento (se recarga cada
    // vez que se entra a la pestaña, porque el padre desmonta este componente
    // al salir de ella).
    useEffect(() => {
        handleSession();
    }, []);

    const cerrarSesion = async (tokenId: number) => {
        try {
            setSessionsMsg({ type: "", text: "" });
            await deleteSession(tokenId);
            setSessionsMsg({ type: "success", text: "Sesión cerrada." });
            await handleSession();
        } catch (error: unknown) {
            console.error("Error cerrando sesión:", error);

        }
    };

    const getDeviceLabel = (ua?: string) => {
        if (!ua) return "Dispositivo desconocido";
        const base = ua.split("(")[0].trim();
        return base || "Dispositivo";
    };

    const getLastUsedLabel = (s: Session) => {
        if (s.is_current) return "Ahora";
        if (s.last_used_at) return `Último uso: ${s.last_used_at}`;
        return "Sin información de uso";
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Seguridad de la Cuenta</h2>

                <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-4">Cambiar Contraseña</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Contraseña Actual
                                </label>
                                <input
                                    type="password"
                                    value={passwordF.actual_p}
                                    onChange={(e) => setPasswordF({ ...passwordF, actual_p: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm lg:text-base"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={passwordF.new_p}
                                    onChange={(e) => setPasswordF({ ...passwordF, new_p: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm lg:text-base"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirmar Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={passwordF.new_p_c}
                                    onChange={(e) => setPasswordF({ ...passwordF, new_p_c: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm lg:text-base"
                                />
                            </div>
                            <button
                                onClick={handleActualizarPassword}
                                disabled={passLoading}
                                className={`px-6 py-2 text-white rounded-lg font-medium text-sm lg:text-base ${passLoading ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                                    }`}
                            >
                                {passLoading ? "Actualizando..." : "Actualizar Contraseña"}
                            </button>
                            {passMsg && (
                                <p className="mt-3 text-sm font-medium text-red-600">
                                    {passMsg}
                                </p>
                            )}
                        </div>
                    </div>


                    <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="font-medium text-gray-900">Sesiones Activas</h3>


                        </div>
                        {sessionsLoading ? (
                            <p className="text-sm text-gray-500">Cargando sesiones...</p>
                        ) : sessions.length === 0 ? (
                            <p className="text-sm text-gray-500">No hay sesiones registradas.</p>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-2 border-b last:border-b-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Globe size={20} className="text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm lg:text-base">
                                                    {getDeviceLabel(s.user_agent)}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {s.ip_address ?? "IP desconocida"} • {getLastUsedLabel(s)}
                                                </p>
                                            </div>
                                        </div>

                                        {s.is_current ? (
                                            <span className="text-sm text-green-600 font-medium">Actual</span>
                                        ) : (
                                            <button
                                                onClick={() => cerrarSesion(s.id)}
                                                className="text-sm text-red-600 font-medium hover:underline"
                                            >
                                                Cerrar
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {sessionsMsg.text && (
                            <p
                                className={`mt-3 text-sm font-medium ${sessionsMsg.type === "success" ? "text-green-600" : "text-red-600"
                                    }`}
                            >
                                {sessionsMsg.text}
                            </p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SeguridadTab;
