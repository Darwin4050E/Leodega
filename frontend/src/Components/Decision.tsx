import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { registerUser } from "../services/users";
import { asApiError } from "../api/errors";
import leodegalogo from '../img/LOGO_LEODEGAISO.png';
import arrendador from '../img/arrendador.png';
import arrendatario from '../img/arrendatario.png';

const Decision = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);


    const handleSelection = async (role: "landlord" | "tenant") => {
        const storeUser = localStorage.getItem('tempUser');
        if (!storeUser) {
            alert("No se encontró información del usuario. Por favor, regístrese nuevamente.");
            return;
        }

        const userData = JSON.parse(storeUser);
        const finalUser = {
            ...userData,
            lastname: userData.lastName,
            role,
            enable_messages: true,
            state: "active",

        };
        delete finalUser.lastName;


        try {
            console.log({
                userData,role
            });
            setLoading(true);
            const responser = await registerUser(finalUser);
            if (responser.status === 201 || responser.status === 200) {
                setTimeout(() => {
                    setLoading(false);
                    alert("Cuenta creada exitosamente");
                    localStorage.removeItem('tempUser');
                    navigate('/login');

                }, 1000);
            }
        } catch (error) {
            console.log(error);
            setLoading(false);
            const apiError = asApiError(error);
            const firstFieldError = apiError.response?.data?.errors
                ? Object.values(apiError.response.data.errors)[0]?.[0]
                : undefined;
            const message =
                firstFieldError ||
                apiError.response?.data?.message ||
                apiError.response?.data?.error ||
                "Error al crear la cuenta. Por favor, intente nuevamente.";
            alert(message);
        }
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="pt-[40px] mb-[10px] pl-[30px] lg:pt-[80px] lg:pl-[60px] lg:mb-[2px]">
                <div className="flex items-center gap-3">
                    <img src={leodegalogo} alt="Logo Leodega" className="h-10 md:h-12" />
                    <img src='/LOGO_LEODEGA TEXTO-19.png' alt="Leodega" className="h-8 md:h-10" />
                </div>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center px-[30px] pb-12 mb-[30px] lg:px-[60px] lg:pb-24 lg:mb-[60px] gap-12 lg:gap-20">
                {loading ? (
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#8b5cf6] mb-4"></div>
                        <p className="text-[#313131] font-medium">Creando cuenta...</p>
                    </div>
                ) : (
                    <>
                        <h2 className="md:text-[35px] text-[28px] text-[#313131] font-semibold text-center">
                            ¿Cuál es su rol en la plataformaa?
                        </h2>

                        <div className="flex flex-col lg:flex-row gap-8 lg:gap-32 justify-center items-stretch w-full max-w-4xl">
                            <button
                                onClick={() => handleSelection("landlord")}
                                className="flex flex-col lg:flex-row items-center gap-4 cursor-pointer hover:scale-105 transition-transform duration-200 p-6 rounded-xl hover:bg-gray-50"
                            >
                                <div className="bg-gray-100 rounded-lg p-4 lg:p-6 flex items-center justify-center h-32 w-32 lg:h-40 lg:w-40">
                                    <img src={arrendador} alt="Arrendador" className="max-h-20 lg:max-h-24 object-contain" />
                                </div>
                                <span className="text-[#313131] font-medium text-[25px]">Arrendador</span>
                            </button>

                            <button
                                onClick={() => handleSelection("tenant")}
                                className="flex flex-col lg:flex-row items-center gap-4 cursor-pointer hover:scale-105 transition-transform duration-200 p-6 rounded-xl hover:bg-gray-50"
                            >
                                <div className="bg-gray-100 rounded-lg p-4 lg:p-6 flex items-center justify-center h-32 w-32 lg:h-40 lg:w-40">
                                    <img src={arrendatario} alt="Arrendatario" className="max-h-20 lg:max-h-24 object-contain" />
                                </div>
                                <span className="text-[#313131] font-medium text-[25px]">Arrendatario</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Decision;