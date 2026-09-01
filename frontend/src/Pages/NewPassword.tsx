import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { resetPassword } from "../services/auth";
import { asApiError } from "../api/errors";
import { Lock } from "lucide-react";

const NewPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const email = params.get("email");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      await resetPassword({
        email,
        token,
        password,
        password_confirmation: confirmPassword,
      });

      setMessage("Tu contraseña ha sido restablecida con éxito.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: unknown) {
      console.error(err);
      setError(asApiError(err).response?.data?.message || "Error al restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-[90%] max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-2">
          Restablecer contraseña
        </h1>
        <p className="text-gray-500 text-center mb-6 text-sm">
          Ingresa tu nueva contraseña para continuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center border rounded-lg p-2">
            <Lock className="text-gray-400 mr-2" size={20} />
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full focus:outline-none text-gray-700"
            />
          </div>

          <div className="flex items-center border rounded-lg p-2">
            <Lock className="text-gray-400 mr-2" size={20} />
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full focus:outline-none text-gray-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[#8b5cf6] text-white py-2 rounded-lg hover:bg-blue-700 transition ${
              loading && "opacity-50 cursor-not-allowed"
            }`}
          >
            {loading ? "Restableciendo..." : "Guardar contraseña"}
          </button>
        </form>

        {message && (
          <div className="mt-4 text-green-600 text-center font-medium">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 text-red-500 text-center font-medium">
            {error}
          </div>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/login")}
            className="text-[#ff8682] hover:underline text-sm"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewPassword;
