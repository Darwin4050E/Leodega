import React from "react";
import { AlertCircle, User, DollarSign } from "lucide-react";

export default function Cancellation() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex justify-center">
      <div className="max-w-5xl w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Cancelación de Reserva</h1>
          <span className="text-gray-500 text-sm ml-2">Hace 2 horas</span>
        </div>

        {/* Alert */}
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
          <p className="font-semibold text-red-700">El cliente ha cancelado la reserva</p>
          <p className="text-sm mt-1 text-gray-700">
            Reserva ID: <strong>LED-2024-081</strong> – Cancelada con 5 días de anticipación
          </p>
          <p className="mt-2 text-sm text-red-600">
            <strong>Razón:</strong> Cambio en necesidades de almacenamiento por reestructuración empresarial
          </p>
        </div>

        {/* Client + Financial Impact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client */}
          <div className="bg-white p-6 shadow-sm rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-6 h-6 text-gray-700" />
              <h3 className="font-semibold text-lg">Cliente que Canceló</h3>
            </div>

            <p className="font-medium">María González</p>
            <p className="text-sm text-gray-600">maria.gonzalez@email.com</p>

            <div className="mt-4 text-sm text-gray-700 space-y-1">
              <p className="font-semibold">Bodega Reservada</p>
              <p>Bodega Centro Logístico Norte</p>
              <p>150 m²</p>

              <p className="font-semibold mt-3">Periodo Original</p>
              <p>15 Agosto 2024 - 15 Noviembre 2024</p>
              <p>3 meses</p>
            </div>
          </div>

          {/* Financial Impact */}
          <div className="bg-white p-6 shadow-sm rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-gray-700" />
              <h3 className="font-semibold text-lg">Impacto Financiero</h3>
            </div>

            <div className="text-sm space-y-2">
              <Row label="Monto pagado por cliente:" value="$5.000.000" />
              <Row label="Tarifa de cancelación:" value="- $500.000" className="text-red-600" />
              <Row label="Penalidad por cancelación:" value="- $1.500.000" className="text-red-600" />
              <Row label="Reembolso al cliente:" value="$3.500.000" className="text-green-600 font-semibold" />
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Los montos se calculan automáticamente según las políticas de cancelación establecidas.
            </p>
          </div>
        </div>

        {/* Required Actions */}
        <div className="bg-white p-6 shadow-sm rounded-xl">
          <h3 className="font-semibold text-lg mb-4">Acciones Requeridas</h3>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">
              Procesar Cancelación
            </button>
            <button className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium">
              Generar Reporte
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm">
            <p className="font-semibold">Próximos pasos:</p>
            <ol className="ml-6 list-decimal mt-2 space-y-1">
              <li>Revisar y aprobar el cálculo de reembolso</li>
              <li>Registrar penalidad de cancelación</li>
              <li>Actualizar disponibilidad de la bodega</li>
              <li>Generar comprobante de cancelación</li>
              <li>Notificar al equipo de operaciones</li>
            </ol>
            <p className="text-yellow-700 font-medium mt-3">
              Tiempo límite: Tienes 48 horas para procesar esta cancelación y generar el reembolso correspondiente.
            </p>
          </div>
        </div>

        {/* Message + Internal Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 shadow-sm rounded-xl">
            <h4 className="font-medium mb-2">Mensaje al Cliente</h4>
            <textarea
              placeholder="Mensaje personalizado para el cliente sobre la cancelación y reembolso..."
              className="w-full border rounded-lg px-3 py-2 h-28"
            />
          </div>

          <div className="bg-white p-6 shadow-sm rounded-xl">
            <h4 className="font-medium mb-2">Notas Internas</h4>
            <textarea
              placeholder="Observaciones para el equipo: motivos adicionales, sugerencias, seguimiento..."
              className="w-full border rounded-lg px-3 py-2 h-28"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col md:flex-row gap-4">
          <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium">
            Procesar Cancelación
          </button>
          <button className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium">
            Revisar Detalles
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}
