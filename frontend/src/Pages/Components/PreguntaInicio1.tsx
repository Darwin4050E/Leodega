import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import FooterNav from "./FooterNav";
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';
import habitacionLogo from '../../img/habitacionLogo.png';
import garajeLogo from '../../img/garajeLogo.png';
import contenedorLogo from '../../img/contenedorLogo.png';
import sotanoLogo from '../../img/sotanoLogo.png';
import aticoLogo from '../../img/aticoLogo.png';
import bodegaLogo from '../../img/bodegaLogo.png';

const PreguntaInicio1: React.FC = () => {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState<string>("");
  

  const options = [
    { id: "habitacion", name: "Habitación", image: habitacionLogo },
    { id: "garaje", name: "Garaje/Parqueadero", image: garajeLogo },
    { id: "contenedor", name: "Contenedor", image: contenedorLogo },
    { id: "sotano", name: "Sótano", image: sotanoLogo },
    { id: "atico", name: "Ático", image: aticoLogo },
    { id: "bodega", name: "Bodega Indep.", image: bodegaLogo },
  ];

  useEffect(() => {
    const storedData = localStorage.getItem("optionData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.step1Data?.selectedOption) {
        setSelectedOption(parsed.step1Data.selectedOption);
      }
    }
  }, []);

 

  const handleOptionClick = (id: string) => {
    setSelectedOption(id);
    const existingData = JSON.parse(localStorage.getItem("optionData") || "{}");
    const updatedData = {
      ...existingData,
      step1Data: { selectedOption: id }
    };

    localStorage.setItem("optionData", JSON.stringify(updatedData));
  };

  

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex justify-end items-center gap-3 p-4 sm:p-6">
        <img src={leodegalogo} alt="Logo Leodega" className="h-8 sm:h-10" />
        <img src='/LOGO_LEODEGA TEXTO-19.png' alt="Leodega" className="h-6 sm:h-8" />
      </header>

      <main className="flex flex-col justify-center items-center flex-1 px-4 sm:px-6">
        <div className="w-full max-w-4xl text-center mt-4 sm:mt-[-90px]">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold mb-3">
            ¿Cuál de estas opciones describe mejor tu espacio?
          </h1>
          <p className="text-gray-500 mb-6 sm:mb-10 text-sm sm:text-base">
            Selecciona la propiedad que tienes. A continuación, indícanos la ubicación.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 justify-items-center mb-8 sm:mb-10 px-2">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={`relative bg-white rounded-xl sm:rounded-2xl border-2 transition-all duration-300 w-full max-w-[180px] sm:max-w-[220px] lg:max-w-[280px] h-[100px] sm:h-[110px] lg:h-[120px] flex items-center justify-center overflow-hidden
                    ${selectedOption === option.id
                    ? "border-purple-500 shadow-lg scale-[1.02] sm:scale-[1.03]"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}>
                <img
                  src={option.image}
                  alt={option.name}
                  className="w-full h-full object-cover"
                />
                <div
                  className={`absolute bottom-0 w-full text-center text-xs sm:text-sm font-medium py-2 transition-colors ${selectedOption === option.id
                      ? "bg-purple-500 text-white"
                      : "bg-gray-50 text-gray-700"
                    }`} >
                  {option.name}
                </div>
              </button>
            ))}
          </div>
          
          <div className="mb-4 sm:mb-6">
            <ProgressBar totalSteps={7} activeIndex={0} />
          </div>
          
          <FooterNav
            onBack={() => navigate("/arrendador/bodegas")} //como no lo usamos en otro lado se quema
            onNext={() => selectedOption && navigate("/preguntainicio2")}
            backDisabled={false}
            nextDisabled={!selectedOption}
          />
        </div>
      </main>
    </div>
  );
};

export default PreguntaInicio1;