import { useState } from "react";
import DatePicker from "react-datepicker";
import { es } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

export interface SearchBarFilters {
  location: string;
  minSize: string;
  minPrice: string;
  maxPrice: string;
}

interface SearchBarProps {
  onSearch: (filters: SearchBarFilters) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [location, setLocation] = useState("");
  const [minSize, setMinSize] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  // Date fields are collected but intentionally not wired into the search
  // filters yet — availability filtering is not part of this change
  // (design decision #7). Kept in the UI so the fields stay available for
  // that follow-up without another layout change.
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [error, setError] = useState<string>("");

  const handleSearch = () => {
    if (maxPrice && minPrice && Number(maxPrice) < Number(minPrice)) {
      setError("El precio máximo debe ser mayor o igual al precio mínimo.");
      return;
    }

    setError("");
    onSearch({ location, minSize, minPrice, maxPrice });
  };

  return (
    <div className="relative z-20 w-full flex justify-center mt-[-2rem] lg:mt-[-3rem] px-4">
      <div className="bg-white rounded-2xl shadow-lg flex flex-col lg:flex-row items-center justify-between px-8 py-6 gap-5 w-full max-w-6xl flex-wrap">

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

        {/* Tamaño mínimo */}
        <div className="flex items-center gap-3 text-gray-600 w-full lg:w-auto">
          <i className="fa-solid fa-ruler-combined text-xl"></i>
          <div className="flex flex-col">
            <label className="font-semibold text-sm text-gray-700">Tamaño mínimo (m²)</label>
            <input
              type="number"
              min={0}
              placeholder="Ej. 10"
              value={minSize}
              onChange={(e) => setMinSize(e.target.value)}
              className="text-sm text-gray-500 focus:outline-none border-b border-gray-200 focus:border-blue-500 transition w-32"
            />
          </div>
        </div>

        <div className="hidden lg:block w-px h-10 bg-gray-200" />

        {/* Precio */}
        <div className="flex items-center gap-3 text-gray-600 w-full lg:w-auto">
          <i className="fa-solid fa-sack-dollar text-xl"></i>
          <div className="flex flex-col">
            <label className="font-semibold text-sm text-gray-700">Precio mensual</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Mín."
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="text-sm text-gray-500 focus:outline-none border-b border-gray-200 focus:border-blue-500 transition w-20"
              />
              <span>-</span>
              <input
                type="number"
                min={0}
                placeholder="Máx."
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="text-sm text-gray-500 focus:outline-none border-b border-gray-200 focus:border-blue-500 transition w-20"
              />
            </div>
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
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-3 rounded-xl transition-all"
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
