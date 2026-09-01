import React, { useState, useEffect } from 'react';
import { Mail, Phone } from 'lucide-react';
import { getProfile, updateProfile } from '../../services/profile';
import { asApiError } from '../../api/errors';

const PerfilTab: React.FC = () => {
    const [perfil, setPerfil] = useState({
        name: "",
        lastname: "",
        email: "",
        phone: "",
    });

    const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error" | ""; text: string }>({
        type: "",
        text: "",
    });
    const [profileErrors, setProfileErrors] = useState<{ email?: string }>({});

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await getProfile();
                setPerfil({
                    name: data.name ?? "",
                    lastname: data.lastname ?? "",
                    email: data.email ?? "",
                    phone: data.phone ?? "",
                });
            } catch (error) {
                console.error("Error cargando perfil:", error);
                setProfileMsg({ type: "error", text: "No se pudo cargar el perfil." });
            }
        };

        load();
    }, []);

    const [loading, setLoading] = useState(false);
    const handleGuardar = async () => {
        try {
            setLoading(true);
            setProfileErrors({});
            setProfileMsg({ type: "", text: "" });

            await updateProfile({
                name: perfil.name,
                lastname: perfil.lastname,
                email: perfil.email,
                phone: perfil.phone,
            });

            setProfileMsg({ type: "success", text: "Perfil actualizado con éxito." });
        } catch (error: unknown) {
            const data = asApiError(error).response?.data;

            const emailError = data?.errors?.email?.[0];

            setProfileErrors({
                email: emailError,
            });

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Información Personal</h2>



                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                            Nombre
                        </label>
                        <input
                            type="text"
                            value={perfil.name}
                            onChange={(e) => setPerfil({ ...perfil, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm lg:text-base"
                        />
                    </div>
                    <div>
                        <label htmlFor="apellido" className="block text-sm font-medium text-gray-700 mb-2">
                            Apellido
                        </label>
                        <input
                            type="text"
                            value={perfil.lastname}
                            onChange={(e) => setPerfil({ ...perfil, lastname: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm lg:text-base"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Mail size={16} className="inline mr-2" />
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            value={perfil.email}
                            onChange={(e) => {
                                setPerfil({ ...perfil, email: e.target.value });
                                setProfileErrors((prev) => ({ ...prev, email: undefined }));
                                setProfileMsg({ type: "", text: "" });
                            }}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${profileErrors.email ? "border-red-500" : "border-gray-300"
                                }`}
                        />
                        {profileErrors.email && (
                            <p className="mt-1 text-xs text-red-600">{profileErrors.email}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Phone size={16} className="inline mr-2" />
                            Teléfono
                        </label>
                        <input
                            type="tel"
                            value={perfil.phone}
                            onChange={(e) => setPerfil({ ...perfil, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm lg:text-base"
                        />
                    </div>

                </div>

                <div> {profileMsg.text && (
                    <p
                        className={`mt-3 text-sm font-medium ${profileMsg.type === "success"
                            ? "text-green-600"
                            : "text-red-600"
                            }`}
                    >
                        {profileMsg.text}
                    </p>
                )}  </div>


                <div className="flex flex-col sm:flex-row gap-3 mt-6">

                    <button onClick={handleGuardar}
                        disabled={loading}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                        {loading ? "Guardando..." : "Guardar Cambios"}
                    </button>

                    <button
                        type="button"
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm lg:text-base"
                        onClick={() => {
                            setProfileMsg({ type: "", text: "" });
                            setProfileErrors({});
                        }}
                    >
                        Cancelar
                    </button>


                </div>
            </div>
        </div>
    );
};

export default PerfilTab;
