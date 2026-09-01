import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import reimage from '../img/reimage.png';
import facebook from '../img/facebook.png';
import google from '../img/google.png';
import apple from '../img/apple.png';
import leodegalogo from '../img/LOGO_LEODEGAISO.png';

const Register = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState({
        phone: "",
        pass1: "",
        pass2: "",
    });


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setError({ phone: "", pass1: "", pass2: "" });
        const newError = { phone: "", pass1: "", pass2: "" };
        let hasError = false;

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            newError.phone = "Formato de Numero incorrecto";
            hasError = true;
        }

        if (password.length < 8) {
            newError.pass1 = "La contraseña debe tener al menos 6 caracteres";
            hasError = true;
        }

        if ((password !== confirmPassword)) {
            newError.pass2 = "Las contraseñas no coinciden";
            hasError = true;
        }

        if (hasError) {
            setError(newError);
            return;
        }

        try {
            
            const userData = {
                name,
                lastName,
                phone,
                email,
                password,
            }

            localStorage.setItem('tempUser', JSON.stringify(userData))

            navigate('/decision')


        } catch (error) {
            console.log("Error paso: ", error);
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

            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center pl-[30px] lg:pl-[110px] pr-[30px] lg:pr-[80px] mt-[-40px]">
                <div className="mt-[-100px] hidden lg:flex w-full lg:w-1/2 justify-center items-center lg:pr-[60px]">
                    <img
                        src={reimage}
                        alt="Register"
                        className="w-[400px] h-[640px] object-cover rounded-xl"
                    />
                </div>

                <div className="w-full lg:w-1/2 rounded-xl mb-8 lg:mb-0 ">
                    <h2 className="text-[30px] text-[#313131] font-semibold mb-4 mt-12 lg:mt-12 sm:mt-0">Registrarse</h2>
                    <p className='font-light text-[#646464] text-[15px] mb-5'>Vamos a prepararlos para que puedan acceder a su cuenta personal.</p>
                    <form onSubmit={handleSubmit}>
                        <div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <div>
                                    <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2">
                                        <legend className="text-sm text-gray-700 px-1">Nombres</legend>
                                        <input
                                            type="text"
                                            className="w-full text-base focus:outline-none px-2 py-1"
                                            placeholder="Ingrese su nombre"
                                            value={name} onChange={(e) => setName(e.target.value)} required
                                        />
                                    </fieldset>
                                </div>
                                <div>
                                    <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2">
                                        <legend className="text-sm text-gray-700 px-1">Apellidos</legend>
                                        <input
                                            type="text"
                                            className="w-full text-base focus:outline-none px-2 py-1"
                                            placeholder="Ingerese su apellido"
                                            value={lastName} onChange={(e) => setLastName(e.target.value)} required
                                        />
                                    </fieldset>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <div>
                                    <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2">
                                        <legend className="text-sm text-gray-700 px-1">Email</legend>
                                        <input
                                            type="email"
                                            className="w-full text-base focus:outline-none px-2 py-1"
                                            placeholder="user@gmail.com"
                                            value={email} onChange={(e) => setEmail(e.target.value)} required
                                        />
                                    </fieldset>
                                </div>
                                <div>
                                    <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2">
                                        <legend className="text-sm text-gray-700 px-1">Phone Number</legend>
                                        <input
                                            type="tel"
                                            className="w-full text-base focus:outline-none px-2 py-1"
                                            placeholder="0000000000"
                                            value={phone} onChange={(e) => setPhone(e.target.value)} required
                                        />
                                    </fieldset>
                                    {error.phone && <p className="text-red-500 text-sm mt-1">{error.phone}</p>}
                                </div>
                            </div>

                            <div className='mb-3'>
                                <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2 relative">
                                    <legend className="text-sm text-gray-700 px-1">Password</legend>
                                    <div className="flex items-center">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="w-full text-base focus:outline-none px-2 py-1 pr-10"
                                            placeholder="***************************"
                                            value={password} onChange={(e) => setPassword(e.target.value)} required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 text-gray-500 hover:text-gray-700"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </fieldset>
                                {error.pass1 && <p className="text-red-500 text-sm mt-1">{error.pass1}</p>}
                            </div>

                            <div className='mb-4'>
                                <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2 relative">
                                    <legend className="text-sm text-gray-700 px-1">Confirm Password</legend>
                                    <div className="flex items-center">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            className="w-full text-base focus:outline-none px-2 py-1 pr-10"
                                            placeholder="***************************"
                                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 text-gray-500 hover:text-gray-700"
                                        >
                                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </fieldset>
                                {error.pass2 && <p className="text-red-500 text-sm mt-1">{error.pass2}</p>}
                            </div>

                            <div className="mb-6">
                                <label className="flex items-start gap-2 text-sm text-gray-700">
                                    <input type="checkbox" className="w-5 h-5 border-2 border-gray-400 rounded mt-0.5" />
                                    <span>Estoy de acuerdo con los <a href="#" className="text-[#ff8682] font-medium">Términos</a> y <a href="#" className="text-[#8b5cf6] font-medium">Políticas de Privacidad</a></span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-[#8b5cf6] text-white py-4 rounded-lg font-medium text-sm mb-4">
                                Crear cuenta
                            </button>

                            <p className="text-center text-gray-700 mb-6 text-sm">
                                ¿Ya tienes una cuenta?{" "} <Link to="/login" className="text-[#ff8682] font-medium">Inicia Sesión</Link>
                            </p>

                            <div className="relative flex items-center justify-center mb-6">
                                <div className="border-t border-gray-300 w-full absolute"></div>
                                <span className="bg-white px-4 relative text-gray-400 text-sm">O regístrate con</span>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <button className="border-2 border-gray-300 rounded-lg py-2 flex items-center justify-center hover:bg-blue-50">
                                    <img src={facebook} alt="Facebook" className="w-8 h-8" />
                                </button>

                                <button className="border-2 border-gray-300 rounded-lg py-2 flex items-center justify-center hover:bg-gray-50">
                                    <img src={google} alt="Google" className="w-[60px] h-[30px]" />
                                </button>

                                <button className="border-2 border-gray-300 rounded-lg py-2 flex items-center justify-center hover:bg-gray-50">
                                    <img src={apple} alt="Apple" className="w-[70px] h-[40px]" />
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>

    );
};

export default Register;
