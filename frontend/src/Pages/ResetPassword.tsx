import React, { useState } from "react";
import { forgotPassword } from "../services/auth";
import { asApiError } from "../api/errors";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await forgotPassword(email);
      setMessage(res.data.message || "Hemos enviado un enlace a tu correo.");
    } catch (err: unknown) {
      setError(asApiError(err).response?.data?.message || "Error al enviar el enlace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-[90%] max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-2">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-gray-500 text-center mb-6 text-sm">
          Ingresa tu correo electrónico y te enviaremos un enlace para
          restablecerla.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center border rounded-lg p-2">
            <Mail className="text-gray-400 mr-2" size={20} />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "Enviando..." : "Enviar enlace"}
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

export default ResetPassword;
