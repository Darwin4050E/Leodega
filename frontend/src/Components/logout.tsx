import React from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { logoutRequest } from "../services/auth";
import { useAuth } from "../context/useAuth";

const LogoutButton: React.FC = () => {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutRequest(token);

      //limpiar en web
      logout();

      delete api.defaults.headers.common["Authorization"];
      navigate("/login", { replace: true });
      
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="mt-6 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-semibold transition"
    >
      Cerrar sesión
    </button>
  );
};

export default LogoutButton;
