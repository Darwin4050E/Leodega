import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import logoh1 from '../img/LOGO_H_1.png'
import logimage from '../img/logimage.png'

const VerifyCode = () => {
    const [code, setCode] = useState('');
    const [showCode, setShowCode] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-white">
           <header className="pt-[40px] mb-[10px] pl-[30px] lg:pt-[80px] lg:pl-[60px] lg:mb-[2px]"><div className="flex items-center gap-3">
                    <img src={logoh1} alt="Logo Leodega" className=" h-10 md:h-12" />
                    
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center pl-[30px] lg:pl-[110px] pr-[30px] lg:pr-[80px] mt-[-40px]">
                <div className="w-full lg:w-1/2 bg-white rounded-xl lg:pr-[90px] mb-8 lg:mb-0">
                    <a href="\login"> &lt; Back to Login</a>
                    <h2 className="text-[30px] text-[#313131] font-semibold mb-4">VerifyCode</h2>
                    <p className='font-light text-[#646464] text-[15px] mb-5'>Un código ha sido enviado a su email</p>
                    <form>
                        <div className='pt-3'>
                            <fieldset className="border-2 border-gray-300 rounded-lg px-3 pt-0 pb-2 mb-4">
                                <legend className="text-sm text-gray-700 px-1">Ingrese el Código</legend>

                                <div className="relative flex items-center">
                                    <input
                                        type={showCode ? "text" : "password"}
                                        className="w-full text-base focus:outline-none px-2 py-1 pr-10" // 👈 espacio para el ícono
                                        placeholder="######"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCode(!showCode)}
                                        className="absolute right-2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showCode ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </fieldset>

                        </div>
                        <div className="flex items-center justify-between mb-6">
                            <p className='text-sm text-[#646464]'>No recibiste el código?</p>
                            <a href="#" className="text-sm text-[#ff8682]">Reenviar</a>
                        </div>
                        <button type="submit" className="w-full bg-[#8b5cf6] text-white py-4 rounded-lg font-medium text-sm mb-6">
                            Verificar
                        </button>
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
}
export default VerifyCode