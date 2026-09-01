import {
  AlertTriangle, Building, Calendar, User, CheckCircle2,
  XCircle,
} from "lucide-react";
import React, { useEffect } from 'react';
import type { Solicitud, ReporteDetalle } from './Interfaces/SolicitudesData';
import { useState } from 'react';
import { getReport } from "../services/reports";


interface SolicitudNuevaProps {
  solicitud: Solicitud;
  onVolver: () => void;
  onRevisarResponder: (solicitud: Solicitud) => void;
}


const SolicitudNueva: React.FC<SolicitudNuevaProps> = ({ solicitud, onVolver, onRevisarResponder }) => {
  const datosCompletos = { ...solicitud };


  const handleRevisarResponder = () => {
    onRevisarResponder(solicitud);
  };
  const obtenerIniciales = (nombre: string) => {
    if (!nombre) return '?';

    const partes = nombre.trim().split(' ');
    const iniciales = partes.slice(0, 2).map(p => p[0].toUpperCase());
    return iniciales.join('');
  };


  const badgeEstado = () => {
    const base = "text-[12px] py-1 px-3 rounded-2xl font-medium";

    switch (datosCompletos.estado) {
      case "En proceso":
        return `${base} bg-yellow-50 text-yellow-700`;
      case "Completada":
        return `${base} bg-green-50 text-green-700`;
      case "Rechazada":
        return `${base} bg-red-50 text-red-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  };

  const iconEstado = () => {
    if (datosCompletos.estado === "En proceso") return <AlertTriangle className="text-yellow-600" size={28} />;
    if (datosCompletos.estado === "Completada") return <CheckCircle2 className="text-green-600" size={28} />;
    if (datosCompletos.estado === "Rechazada") return <XCircle className="text-red-600" size={28} />;
    return <AlertTriangle className="text-gray-600" size={28} />;
  };

  const colorIconBox = () => {
    if (datosCompletos.estado === "En proceso") return "bg-yellow-100";
    if (datosCompletos.estado === "Completada") return "bg-green-100";
    if (datosCompletos.estado === "Rechazada") return "bg-red-100";
    return "bg-gray-100";
  };

  const [reporte, setReporte] = useState<ReporteDetalle | null>(null);
  useEffect(() => {

    (async () => {

      const res = await getReport(datosCompletos.id);
      const detalle = res.data?.report ?? res.data;
      setReporte(detalle);

    })();
  }, [datosCompletos.id]);



  const [imagenAbierta, setImagenAbierta] = useState<string | null>(null);
  return (
    <div className="pl-8 pt-5 pr-8 bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className={`${colorIconBox()} rounded-3xl p-2 flex-shrink-0 h-12 w-12`}>
              <div className="flex justify-center items-center pt-[2px] pl-[2px]">
                {iconEstado()}
              </div>
            </div>

            <div>
              <h2 className="text-[23px] font-bold text-gray-900 mb-1">
                Reporte #{String(datosCompletos.id).padStart(5, "0")}
              </h2>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} />
                <p>Fecha: <b className="text-gray-900">{datosCompletos.fecha}</b></p>
              </div>



            </div>
          </div>
        </div>


        <div className="rounded-md mb-3">
          <span className={badgeEstado()}>{datosCompletos.estado}</span>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <User />
              <h3 className="my-3 text-[22px] ml-2 mr-10 font-semibold text-gray-900 leading-6">
                Usuario
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {obtenerIniciales(datosCompletos.nombre)}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900">{datosCompletos.nombre}</h4>
                </div>
              </div>

              <div className="border-t border-gray-300 my-4"></div>


              {datosCompletos.email ? (
                <div className="text-sm text-gray-600 break-all">
                  {datosCompletos.email}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  (Sin datos de contacto en este reporte)
                </div>
              )}
            </div>
          </div>


          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building />
              <h3 className="my-3 text-[22px] ml-2 mr-14 font-semibold text-gray-900 leading-6">
                Detalles del Reporte
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1">DIRECCIÓN</span>
                <span className="text-sm text-gray-900 font-semibold block">
                  {datosCompletos.direccion.split(",").slice(-4).join(", ")}
                </span>

              </div>

              <div className="border-t border-gray-300 my-4"></div>

              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1">TIPO</span>
                <span className="text-sm text-gray-900 font-semibold">{datosCompletos.tipo}</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building />
              <h3 className="my-3 text-[22px] ml-2 mr-14 font-semibold text-gray-900 leading-6">
                Evidencias
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1">TITULO</span>
                <span className="text-sm text-gray-900 font-semibold block">
                  {reporte?.title}
                </span>

              </div>

              <div className="border-t border-gray-300 my-4"></div>

              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1">DESCRIPCION</span>
                <span className="text-sm text-gray-900 font-semibold">{reporte?.description}</span>
              </div>

              {reporte?.evidences?.map(ev => (

                <div key={ev.id} className="mt-2">
                  <button
                    onClick={() => {
                      const base = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");
                      const url = `${base}/storage/${ev.file_path}`;
                      setImagenAbierta(url);
                      console.log("IMG URL:", url);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
                  >
                    Ver Imagen
                  </button>
                </div>
              ))}
            </div>
          </div>



        </div>
      </div>

      {imagenAbierta && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-xl shadow-lg max-w-xl w-full relative">

            <button

              onClick={() => setImagenAbierta(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
            >
              ✕
            </button>

            <img
              src={imagenAbierta}
              alt="imagen evidencia"
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}


      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <button
            onClick={handleRevisarResponder}
            className="text-[15px] flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
          >
            Revisar y Resolver
          </button>

          <button
            onClick={onVolver}
            className="text-[15px] flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
          >
            Ver Reportes
          </button>
        </div>

        <div className="text-sm text-gray-600">
          *Este módulo se llama “Solicitudes” en el código, pero corresponde a Reportes de administración.
        </div>
      </div>
    </div>
  );
};

export default SolicitudNueva;