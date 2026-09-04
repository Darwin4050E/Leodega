import { useEffect, useMemo, useState } from "react";

import { getLandlordReservations, type LandlordReservation } from "../../services/reservations";
import { asApiError } from "../../api/errors";
import { formatUSD } from "../../utils/money";
import {
  deriveVigencia,
  isCancellableByGestor,
  derivePagoEstado,
  type PagoEstado,
} from "../../utils/reservationEligibility";
import CancelarReservaModal from "./CancelarReservaModal";

const VIGENCIA_LABEL: Record<string, { label: string; color: string }> = {
  activa: { label: "Activa", color: "#16A34A" },
  futura: { label: "Futura", color: "#7551E9" },
  finalizada: { label: "Finalizada", color: "#9CA3AF" },
};

const PAGO_STYLE: Record<PagoEstado, { bg: string; fg: string; label: string }> = {
  PAGADO: { bg: "#DCFCE7", fg: "#15803D", label: "Pagado" },
  PENDIENTE: { bg: "#FEF3C7", fg: "#B45309", label: "Pago pendiente" },
  REEMBOLSADO: { bg: "#EEF2FF", fg: "#4338CA", label: "Reembolsado" },
  "Sin cobro": { bg: "#F3F4F6", fg: "#6B7280", label: "Sin cobro" },
};

function clienteNombre(r: LandlordReservation): string {
  const name = r.tenants?.user?.name ?? "";
  const lastname = r.tenants?.user?.lastname ?? "";
  const full = `${name} ${lastname}`.trim();
  return full || "Cliente";
}

const PagoBadge = ({ pago }: { pago: PagoEstado }) => {
  const s = PAGO_STYLE[pago];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
      style={{ color: s.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.fg }}></span>
      {s.label}
    </span>
  );
};

const VigenciaBadge = ({ vigencia }: { vigencia: string }) => {
  const v = VIGENCIA_LABEL[vigencia] ?? VIGENCIA_LABEL.finalizada;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
      style={{ color: v.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }}></span>
      {v.label}
    </span>
  );
};

/**
 * Rebuilt gestor reservations surface (Block B/C, obs #149 DECISION 2).
 * Mirrors GestorReservas (PrototipoLeodega-main/js/GestorReservasPublicar.jsx:507-675)
 * for table + KPI tiles + filters + in-page detail swap, minus the view
 * toggle (Tabla/Tarjetas/Timeline) and the Editar action -- both
 * deliberately out of scope for this change.
 */
const GestorReservas = () => {
  const [reservations, setReservations] = useState<LandlordReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");

  const [cliente, setCliente] = useState("");
  const [pagoFilter, setPagoFilter] = useState<"" | PagoEstado>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  useEffect(() => {
    getLandlordReservations()
      .then((res) => setReservations(res.data))
      .catch((error) => {
        const apiError = asApiError(error);
        setLoadError(apiError.response?.data?.message || "No se pudieron cargar las reservas.");
      })
      .finally(() => setLoading(false));
  }, []);

  const resetFilters = () => {
    setCliente("");
    setPagoFilter("");
    setDesde("");
    setHasta("");
  };

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const matchesCliente = clienteNombre(r).toLowerCase().includes(cliente.toLowerCase());
      const matchesPago = pagoFilter === "" || derivePagoEstado(r) === pagoFilter;
      const matchesDesde = desde === "" || r.start_date >= desde;
      const matchesHasta = hasta === "" || r.end_date <= hasta;
      return matchesCliente && matchesPago && matchesDesde && matchesHasta;
    });
  }, [reservations, cliente, pagoFilter, desde, hasta]);

  const kpis = useMemo(() => {
    const activas = filtered.filter((r) => deriveVigencia(r.start_date, r.end_date) === "activa").length;
    const futuras = filtered.filter((r) => deriveVigencia(r.start_date, r.end_date) === "futura").length;
    const cobrado = filtered
      .filter((r) => r.status !== "canceled")
      .reduce((sum, r) => sum + Number(r.total_mount ?? 0), 0);

    return {
      reservas: filtered.length,
      activas,
      futuras,
      cobrado,
    };
  }, [filtered]);

  const handleCancelled = (updated: LandlordReservation) => {
    // cancelByLandlord() always records a cancellation obligation, so the
    // resulting row is unconditionally "paid" with a refund owed -- the
    // cancel endpoint's response does not carry payment_status /
    // has_refund_obligation (only landlordIndex() computes those), so they
    // are set explicitly here rather than re-fetching the whole list.
    setReservations((prev) =>
      prev.map((r) =>
        r.id === updated.id
          ? { ...r, ...updated, payment_status: "paid", has_refund_obligation: true }
          : r
      )
    );
    setCancelingId(null);
  };

  const selected = selectedId !== null ? reservations.find((r) => r.id === selectedId) ?? null : null;

  if (selected) {
    const vigencia = deriveVigencia(selected.start_date, selected.end_date);
    const pago = derivePagoEstado(selected);
    const cancellable = isCancellableByGestor(selected);
    const nombre = clienteNombre(selected);
    const bodega = selected.storeRooms?.title ?? "Bodega";

    return (
      <div className="px-6 py-5 bg-[#F5F6FA] min-h-screen">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 py-1.5 text-[#7551E9] text-sm font-semibold mb-4"
        >
          ← Volver a Reservas
        </button>

        <div className="bg-white rounded-2xl p-7 max-w-2xl shadow-sm border border-[#EDEEF2]">
          <div className="flex justify-between items-start mb-5 pb-5 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 m-0">Reserva #{selected.id}</h2>
              <p className="text-gray-500 text-sm mt-1">{bodega}</p>
            </div>
            <PagoBadge pago={pago} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              ["Cliente", nombre],
              ["Email", selected.tenants?.user?.email ?? "—"],
              ["Inicio", selected.start_date],
              ["Fin", selected.end_date],
              ["Vigencia", VIGENCIA_LABEL[vigencia].label],
              ["Monto total", formatUSD(selected.total_mount ?? 0, { suffix: true })],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900 m-0">{value}</p>
              </div>
            ))}
          </div>

          {pago === "REEMBOLSADO" ? (
            <div className="bg-[#FEF2F2] border border-[#FBD5D5] rounded-lg px-3.5 py-3 flex gap-2.5 items-start">
              <div>
                <p className="text-[#B91C1C] text-xs font-semibold m-0">
                  Reserva cancelada por ti. Se notificó a {nombre} y se generó el reembolso.
                </p>
                {selected.cancelation_reason && (
                  <p className="text-gray-500 text-xs mt-1">
                    Motivo registrado: &ldquo;{selected.cancelation_reason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ) : pago === "Sin cobro" ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-3">
              <p className="text-gray-600 text-xs m-0">
                Esta reserva fue cancelada automáticamente al confirmarse otra reserva en las
                mismas fechas. No se cobró al cliente.
              </p>
            </div>
          ) : (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3.5 py-3 flex gap-2.5 items-center">
              <p className="text-[#15803D] text-xs m-0">
                Reserva confirmada automáticamente al pagar (instant-book). No requiere tu
                aprobación.
              </p>
            </div>
          )}

          <div className="flex gap-2.5 mt-5 flex-wrap">
            <button className="flex items-center gap-1.5 px-4 py-2.5 bg-[#7551E9] text-white rounded-lg text-sm font-semibold">
              Mensaje al cliente
            </button>
            <button className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">
              Descargar comprobante
            </button>
            {cancellable && (
              <button
                onClick={() => setCancelingId(selected.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-red-600 border border-red-300 rounded-lg text-sm font-semibold ml-auto"
              >
                Cancelar reserva
              </button>
            )}
          </div>
        </div>

        {cancelingId === selected.id && (
          <CancelarReservaModal
            reservation={selected}
            clienteNombre={nombre}
            bodegaTitulo={bodega}
            onClose={() => setCancelingId(null)}
            onCancelled={handleCancelled}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-6 py-5 bg-[#F5F6FA] min-h-screen">
      <div className="flex justify-between items-end mb-4 flex-wrap gap-2.5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 m-0">Reservas de mis bodegas</h1>
          <p className="text-gray-500 text-sm mt-1">
            Reservas confirmadas al instante. El pago confirma la renta — sin aprobación manual.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {[
          ["Reservas", kpis.reservas, "#7551E9"],
          ["Activas", kpis.activas, "#16A34A"],
          ["Futuras", kpis.futuras, "#2563EB"],
          ["Cobrado (USD)", formatUSD(kpis.cobrado), "#B45309"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="bg-white rounded-xl px-4.5 py-4 border border-[#EDEEF2] shadow-sm">
            <p className="text-xs text-gray-400 mb-1.5">{label}</p>
            <p className="text-xl font-bold m-0" style={{ color: color as string }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-4 flex-wrap shadow-sm">
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5">Cliente</label>
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Buscar cliente"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5">Estado de pago</label>
          <select
            value={pagoFilter}
            onChange={(e) => setPagoFilter(e.target.value as "" | PagoEstado)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 outline-none cursor-pointer"
          >
            <option value="">Todos</option>
            <option value="PAGADO">Pagado</option>
            <option value="PENDIENTE">Pago pendiente</option>
            <option value="REEMBOLSADO">Reembolsado</option>
            <option value="Sin cobro">Sin cobro</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1.5">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 outline-none cursor-pointer"
          />
        </div>
        <button onClick={resetFilters} className="px-3.5 py-2.5 text-red-500 text-sm font-semibold">
          ↺ Reiniciar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Cargando reservas...</div>
      ) : loadError ? (
        <div className="text-center py-10 text-red-600">{loadError}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-12 text-center border border-dashed border-gray-300">
          <p className="text-gray-900 font-semibold m-0 mb-1">Sin reservas con estos filtros</p>
          <p className="text-gray-500 text-sm m-0">Ajusta el rango de fechas, el estado o el cliente.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-[#EDEEF2]">
          <table className="w-full border-collapse text-sm min-w-[780px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["#", "CLIENTE", "BODEGA", "PERÍODO", "VIGENCIA", "PAGO", "MONTO"].map((h) => (
                  <th
                    key={h}
                    className="px-4.5 py-3 text-left font-semibold text-gray-500 text-[11px] tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const vigencia = deriveVigencia(r.start_date, r.end_date);
                const pago = derivePagoEstado(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="border-b border-gray-100 cursor-pointer hover:bg-[#F5F3FF]"
                  >
                    <td className="px-4.5 py-3 text-gray-400 font-medium">{r.id}</td>
                    <td className="px-4.5 py-3">
                      <p className="font-semibold text-gray-900 m-0">{clienteNombre(r)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{r.tenants?.user?.email ?? ""}</p>
                    </td>
                    <td className="px-4.5 py-3 text-gray-700">{r.storeRooms?.title ?? "Bodega"}</td>
                    <td className="px-4.5 py-3 text-gray-500 whitespace-nowrap">
                      {r.start_date} → {r.end_date}
                    </td>
                    <td className="px-4.5 py-3">
                      <VigenciaBadge vigencia={vigencia} />
                    </td>
                    <td className="px-4.5 py-3">
                      <PagoBadge pago={pago} />
                    </td>
                    <td className="px-4.5 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {formatUSD(r.total_mount ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4.5 py-3 border-t border-gray-200 text-xs text-gray-400">
            Mostrando {filtered.length} de {reservations.length} reservas
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorReservas;
