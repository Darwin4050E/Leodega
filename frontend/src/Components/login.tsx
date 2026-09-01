import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { login as loginRequest } from "../services/auth";
import { useAuth } from "../context/useAuth";
import { asApiError } from "../api/errors";
import { Link } from 'react-router-dom';
import facebook from '../img/facebook.png';
import google from '../img/google.png';
import apple from '../img/apple.png';
import logimage from '../img/logimage.png';
import leodegalogo from '../img/LOGO_LEODEGAISO.png';

const Login: React.FC = () => {

    const navigate = useNavigate();
    const { logout, login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const Login = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        setLoading(true);

        try {
            // limpiamos nuevamente para que no sobreescriba
            logout();
            const { data } = await loginRequest(email, password);
            login(data.token, data.user);

            if (data.user.role === "landlord") {
                navigate("/arrendador/bodegas");
            } else if (data.user.role === "admin") {
                navigate("/admin/bodegas");
            } else if (data.user.role === "tenant") {
                navigate("/arrendatario/dashboard");
            } else {
                navigate("/");
            }

        } catch (error: unknown) {
            const err = asApiError(error);
            const msg =
                err.response?.data?.message ||
                err.response?.data?.error ||
                "Error al iniciar sesión";
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex flex-col">
            <header className="pt-[30px] mb-[10px] pr-[30px] lg:pt-[50px] lg:pb-10 lg:pr-[60px] lg:mb-[2px]">
                <div className="flex items-center gap-3 justify-end">
                    <img src={leodegalogo} alt="Logo Leodega" className="h-10 md:h-12" />
                    <img src='/LOGO_LEODEGA TEXTO-19.png' alt="Leodega" className="h-8 md:h-10" />
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center pl-[30px] lg:pl-[110px] pr-[30px] lg:pr-[80px] mt-[-20px] ">
                <div className="w-full lg:w-1/2 bg-white rounded-xl lg:pr-[90px] mb-8 lg:mb-0">
                    <h2 className="text-[30px] text-[#313131] font-semibold mb-4">Iniciar Sesión</h2>
                    <p className='font-light text-[#646464] text-[15px] mb-5'>Inicia sesión para ver las bodegas</p>
                    <form onSubmit={Login}>
                        <div>
                            <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2">
                                <legend className="text-sm text-gray-700 px-1">Email</legend>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full text-base focus:outline-none px-2 py-1"
                                    placeholder="user@gmail.com"
                                    required
                                />
                            </fieldset>
                        </div>
                        <div className='pt-3'>
                            <fieldset className=" border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2 mb-4">
                                <legend className="text-sm text-gray-700 px-1">Contraseña</legend>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)} required
                                    className="w-full text-base focus:outline-none px-2 py-1"
                                    placeholder="************"
                                />
                            </fieldset>
                        </div>
                        {errorMsg && (
                            <p className="text-red-500 text-sm mb-3">{errorMsg}</p>
                        )}
                        <div className="flex items-center justify-between mb-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" className="w-5 h-5 border-2 border-gray-400 rounded" />
                                Recuérdame**
                            </label>
                            <Link to="/ResetPassword" className="text-sm text-[#ff8682]">Olvidé mi contraseña</Link>
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-[#8b5cf6] text-white py-4 rounded-lg font-medium text-sm mb-6">
                            {loading ? "Ingresando..." : "Iniciar Sesión"}
                        </button>
                        <p className="text-center text-gray-700 mb-6 text-sm ">
                            ¿Todavía no tienes cuenta?{" "} <Link to='/register' className="text-[#ff8682] font-medium">Regístrate</Link>
                        </p>
                        <div className="relative flex items-center justify-center mb-6">
                            <div className="border-t border-gray-300 w-full absolute"></div>
                            <span className="bg-white px-4 relative text-gray-400 text-sm">O inicia sesión con</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <button className="border-2 border-gray-300 rounded-lg py-3 flex items-center justify-center hover:bg-blue-50">
                                <img src={facebook} alt="Facebook" className="w-8 h-8" />
                            </button>

                            <button className="border-2 border-gray-300 rounded-lg py-3 flex items-center justify-center hover:bg-gray-50">
                                <img src={google} alt="Google" className="w-[60px] h-[30px]" />
                            </button>

                            <button className="border-2 border-gray-300 rounded-lg py-3 flex items-center justify-center hover:bg-gray-50">
                                <img src={apple} alt="Apple" className="w-[70px] h-[40px]" />
                            </button>
                        </div>
                    </form>
                </div>

                <div className="mt-[-40px] hidden lg:flex w-full lg:w-1/2 justify-center items-center">
                    <img
                        src={logimage}
                        alt="Login"
                        className="w-[550px] h-[600px] object-cover rounded-xl"
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
