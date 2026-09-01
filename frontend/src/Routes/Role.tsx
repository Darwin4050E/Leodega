import { Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

type Props = {
  allowed: Array<"admin" | "landlord">;
};

export default function Role({ allowed }: Props) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return null;
  }

  const role = user?.role;

  if (!allowed.includes(role as "admin" | "landlord")) {
    return (
      <div className="p-6 text-center text-red-600 font-semibold">
        No tienes permisos para acceder a esta sección
      </div>
    );
  }

  return <Outlet />;
}
