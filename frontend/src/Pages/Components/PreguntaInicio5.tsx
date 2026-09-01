import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import FooterNav from "./FooterNav";
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';
const PreguntaInicio5 = () => {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    const storedData = localStorage.getItem("optionData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.titleData) {
        setTitulo(parsed.titleData.titulo || "");
        setDescripcion(parsed.titleData.descripcion || "");
      }
    }
  }, []);

  const handleDescription = () => {
      const existingData = JSON.parse(localStorage.getItem("optionData") || "{}");

    const updatedData = {
      ...existingData,
      titleData: {
        titulo,
        descripcion
      }
    }

    localStorage.setItem("optionData", JSON.stringify(updatedData));
  }

  useEffect(()=> {
    if(titulo || descripcion){
      handleDescription();
    }
  }, [titulo, descripcion]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex justify-end items-center gap-3 p-6">
        <img
          src= {leodegalogo}
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
          <h1 className="text-2xl sm:text-3xl font-semibold mb-3">
            Da un título y descripción a tu bodega
          </h1>
          <p className="text-gray-500 mb-10 text-sm sm:text-base">
            Comparte lo que hace que tu espacio sea especial.
          </p>

          {/* Campos */}
          <div className="text-left">
            <label htmlFor="titulo" className="block text-gray-700 font-medium mb-2">
              Título
            </label>
            <input
              id="titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Escribe un título para tu bodega"
              className="w-full border border-gray-300 rounded-md p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <label htmlFor="descripcion" className="sr-only">Descripción</label>
            <textarea
              id="descripcion"
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ideal para almacenar muebles y cajas durante una mudanza o remodelación..."
              className="w-full border border-gray-300 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            ></textarea>

            {/* Contador */}
            <p className="text-gray-400 text-right text-sm mt-1">
              {descripcion.length}/500
            </p>
          </div>

          <ProgressBar totalSteps={7} activeIndex={4} />

          <FooterNav
            onBack={() => navigate('/PreguntaInicio4')}
            onNext={() => {
              handleDescription();
              navigate('/PreguntaInicio6')}}
            nextDisabled={!titulo || !descripcion}
          />
        </div>
      </main>
    </div>
  );
};

export default PreguntaInicio5;
