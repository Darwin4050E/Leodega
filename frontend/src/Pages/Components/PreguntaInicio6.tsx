import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import FooterNav from "./FooterNav";
// import leodega from '../../img/LOGO_LEODEGATEXTO-19.png';
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';
const PreguntaInicio6 = () => {
  const navigate = useNavigate();
  const [precio, setPrecio] = useState("");
  const [tamano, setTamano] = useState("");

  const precioBase = precio ? Number.parseFloat(precio) : 0;
  const tarifaServicio = precioBase * 0.1; // 10% ejemplo
  const ganancia = precioBase - tarifaServicio;


  useEffect(()=>{
    const storedData = localStorage.getItem("optionData");
    if(storedData){
      const parsed = JSON.parse(storedData);
      if(parsed.priceData){
        setPrecio(parsed.priceData.precio || "");
        setTamano(parsed.priceData.tamano || "");
      }
    }
  }, []);


  const handlePrice = () => {
    const existingData = JSON.parse(localStorage.getItem("optionData") || "{}");

    const updatedData = {
      ...existingData,
      priceData : {
        precio,
        tamano
      }
    }

    localStorage.setItem("optionData", JSON.stringify(updatedData));
  }

  useEffect (()=>{
    if(precio||tamano){
      handlePrice();
    }
  }, [precio, tamano]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex justify-end items-center gap-3 p-6">
        <img
          src={leodegalogo}
          alt="Logo Leodega"
          className="h-10"
        />
        <img
          src='/LOGO_LEODEGA TEXTO-19.png'
          alt="Leodega"
          className="h-8"
        />
      </header>

      {/* Contenido principal */}
      <main className="flex flex-col justify-center items-center flex-1 px-6 mt-[-90px] ">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-2">
            Configura un precio y tamaño de bodega
          </h1>
          <p className="text-gray-500 mb-10 text-sm sm:text-base">
            Consejo: $NN. Luego establecerás uno para cada fin de semana
          </p>

          {/* Inputs centrales */}
          <div className="flex justify-center items-center gap-6 mb-10">
            <div className="flex items-center text-4xl sm:text-5xl font-bold">
              <span className="mr-2">$</span>
              <input
                type="number"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-28 text-center border-b-2 border-gray-400 focus:border-purple-500 outline-none"
                placeholder="NN"
              />
            </div>

            <div className="flex items-center text-4xl sm:text-5xl font-bold">
              <input
                type="number"
                min="0"
                value={tamano}
                onChange={(e) => setTamano(e.target.value)}
                className="w-24 text-center border-b-2 border-gray-400 focus:border-purple-500 outline-none"
                placeholder="m²"
              />
              <span className="ml-2 text-2xl">m²</span>
            </div>
          </div>

          {/* Tabla */}
          <div className="border rounded-xl p-6 w-full sm:w-3/4 mx-auto text-left shadow-sm">
            <div className="flex justify-between py-1 text-lg">
              <span>Precio base</span>
              <span>${precioBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-lg border-t border-gray-200">
              <span>Tarifa por servicio</span>
              <span>${tarifaServicio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-lg border-t border-gray-200 font-semibold">
              <span>Ganas</span>
              <span>${ganancia.toFixed(2)}</span>
            </div>
          </div>

          <ProgressBar totalSteps={7} activeIndex={5} />

          <FooterNav
            onBack={() => navigate('/PreguntaInicio5')}
            onNext={() =>{ 
              handlePrice();
              navigate('/PreguntaInicio7')}}
            nextDisabled={!precio || !tamano}
          />
        </div>
      </main>
    </div>
  );
};

export default PreguntaInicio6;
