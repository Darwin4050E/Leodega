import React, { useState } from "react";
import DatePicker from "react-datepicker";
import { es } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";

const SearchBar = () => {
  const navigate = useNavigate();

  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [error, setError] = useState<string>("");

  const handleSearch = () => {
    if (!location.trim()) {
      setError("Por favor, ingresa una ubicación.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Por favor, selecciona ambas fechas.");
      return;
    }
    if (endDate < startDate) {
      setError("La fecha de fin debe ser posterior a la de inicio.");
      return;
    }

    setError("");

    // 👉 Redirigir a la pantalla de listado
    navigate("/listado", {
      state: { location, startDate, endDate },
    });
  };

  return (
    <div className="relative z-20 w-full flex justify-center mt-[-2rem] lg:mt-[-3rem] px-4">
      <div className="bg-white rounded-2xl shadow-lg flex flex-col lg:flex-row items-center justify-between px-8 py-6 gap-5 w-full max-w-6xl">
        
        {/* Campo de ubicación */}
        <div className="flex items-center gap-3 text-gray-600 w-full lg:w-auto">
          <i className="fa-solid fa-location-dot text-xl"></i>
          <div className="flex flex-col">
            <label className="font-semibold text-sm text-gray-700">Ubicación</label>
            <input
              type="text"
              placeholder="Busca según tu ubicación"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-sm text-gray-500 focus:outline-none border-b border-gray-200 focus:border-blue-500 transition w-56"
            />
          </div>
        </div>

        <div className="hidden lg:block w-px h-10 bg-gray-200" />

        {/* Fecha de inicio */}
        <div className="flex items-center gap-3 text-gray-600 w-full lg:w-auto">
          <i className="fa-regular fa-calendar text-xl"></i>
          <div className="flex flex-col">
            <label className="font-semibold text-sm text-gray-700">Fecha de inicio</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              dateFormat="dd MMM yyyy, HH:mm"
              showTimeSelect
              locale={es}
              placeholderText="Selecciona fecha"
              className="text-sm text-gray-500 focus:outline-none border-b border-gray-200 focus:border-blue-500 transition w-56"
            />
          </div>
        </div>

        <div className="hidden lg:block w-px h-10 bg-gray-200" />

        {/* Fecha de fin */}
        <div className="flex items-center gap-3 text-gray-600 w-full lg:w-auto">
          <i className="fa-regular fa-calendar text-xl"></i>
          <div className="flex flex-col">
            <label className="font-semibold text-sm text-gray-700">Fecha de fin</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              dateFormat="dd MMM yyyy, HH:mm"
              showTimeSelect
              locale={es}
              placeholderText="Selecciona fecha"
              className="text-sm text-gray-500 focus:outline-none border-b border-gray-200 focus:border-blue-500 transition w-56"
            />
          </div>
        </div>

        {/* Botón */}
        <button
          onClick={handleSearch}
          disabled={!location || !startDate || !endDate}
          className={`${
            !location || !startDate || !endDate
              ? "bg-purple-300 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700"
          } text-white font-semibold px-8 py-3 rounded-xl transition-all`}
        >
          Buscar
        </button>
      </div>

      {/* Mensaje de error */}
      {error && (
        <p className="absolute bottom-[-2rem] text-red-600 text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
};

export default SearchBar;
