import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  getUsers,
  blockUser,
  reactivateUser,
  type UserListItem,
  type UserState,
} from "../services/users";
import { asApiError } from "../api/errors";
import ModalConfirmacion from "../Components/ModalConfirmacion";

const ESTADO_LABEL: Record<UserState, string> = {
  active: "Activo",
  blocked: "Bloqueado",
  pending: "Pendiente",
};

function claseEstado(state: UserState): string {
  switch (state) {
    case "active":
      return "bg-green-100 text-green-700";
    case "blocked":
      return "bg-red-100 text-red-700";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

const UsuariosAdmin: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const [usuarioABloquear, setUsuarioABloquear] = useState<UserListItem | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [usuarioAReactivar, setUsuarioAReactivar] = useState<UserListItem | null>(null);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const { data } = await getUsers();
      setUsuarios(data);
    } catch (error) {
      console.error("Error cargando usuarios", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return usuarios.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.lastname.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term) ||
        ESTADO_LABEL[u.state].toLowerCase().includes(term),
    );
  }, [usuarios, searchTerm]);

  const MOTIVO_MIN = 5;
  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= MOTIVO_MIN;
  const motivoMuyCorto = motivoLimpio.length > 0 && motivoLimpio.length < MOTIVO_MIN;

  const cerrarDialogoBloqueo = () => {
    setUsuarioABloquear(null);
    setMotivo("");
    setEnviando(false);
  };

  const confirmarBloqueo = async () => {
    if (!usuarioABloquear || !motivoValido || enviando) {
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      await blockUser(usuarioABloquear.id, motivo.trim());
      await cargarUsuarios();
      cerrarDialogoBloqueo();
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.response?.status === 409) {
        setAviso("La cuenta ya estaba bloqueada. Se actualizó la lista.");
        await cargarUsuarios();
        cerrarDialogoBloqueo();
      } else {
        setAviso(
          apiError.response?.data?.message ?? "No se pudo bloquear la cuenta.",
        );
        setEnviando(false);
      }
    }
  };

  const confirmarReactivacion = async () => {
    if (!usuarioAReactivar) {
      return;
    }
    setAviso(null);
    try {
      await reactivateUser(usuarioAReactivar.id);
      await cargarUsuarios();
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.response?.status === 409) {
        setAviso("La cuenta ya estaba activa. Se actualizó la lista.");
        await cargarUsuarios();
      } else {
        setAviso(
          apiError.response?.data?.message ?? "No se pudo reactivar la cuenta.",
        );
      }
    } finally {
      setUsuarioAReactivar(null);
    }
  };

  return (
    <div className="px-4 lg:pl-8 lg:pr-8 pt-5 bg-[#f5f6fa] min-h-screen">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Usuarios</h1>

      <div className="flex items-center gap-2 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-2 max-w-md">
        <Search className="w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar usuario"
          aria-label="Buscar usuario"
          className="flex-1 bg-white border-0 text-sm text-gray-700 focus:outline-none"
        />
      </div>

      {aviso && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
        >
          {aviso}
        </div>
      )}

      {loading ? (
        <div className="p-6">Cargando usuarios...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "NOMBRE", "CORREO", "ROL", "ESTADO", "ACCIONES"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usuariosFiltrados.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{u.id.toString().padStart(5, "0")}</td>
                  <td className="px-6 py-4">
                    {u.name} {u.lastname}
                  </td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">{u.role}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-md ${claseEstado(u.state)}`}
                    >
                      {ESTADO_LABEL[u.state]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === "admin" ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : u.state === "blocked" ? (
                      <button
                        onClick={() => setUsuarioAReactivar(u)}
                        className="text-sm font-medium text-green-600 hover:text-green-700"
                      >
                        Reactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setUsuarioABloquear(u);
                          setMotivo("");
                        }}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Bloquear
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between px-6 py-4 border-t text-sm text-gray-500">
            Mostrando {usuariosFiltrados.length} usuarios
          </div>
        </div>
      )}

      {usuarioABloquear && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-[90%] max-w-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Bloquear cuenta
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Vas a bloquear a {usuarioABloquear.name} {usuarioABloquear.lastname}.
              Indica el motivo (obligatorio).
            </p>

            <label
              htmlFor="motivo-bloqueo"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Motivo
            </label>
            <textarea
              id="motivo-bloqueo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {motivoMuyCorto && (
              <p className="mt-1 text-xs text-red-600">Mínimo 5 caracteres.</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={cerrarDialogoBloqueo}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBloqueo}
                disabled={!motivoValido || enviando}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalConfirmacion
        isOpen={usuarioAReactivar !== null}
        onClose={() => setUsuarioAReactivar(null)}
        titulo="Reactivar cuenta"
        mensaje={
          usuarioAReactivar
            ? `Se reactivará la cuenta de ${usuarioAReactivar.name} ${usuarioAReactivar.lastname}.`
            : undefined
        }
        textoBoton="Reactivar"
        onConfirm={confirmarReactivacion}
      />
    </div>
  );
};

export default UsuariosAdmin;
