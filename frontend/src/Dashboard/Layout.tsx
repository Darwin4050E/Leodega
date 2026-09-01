import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { HeaderDashboard } from "./HeaderDashboard";
import SidebarAdmin from "./SidebarAdmin";
import { useAuth } from "../context/useAuth";

const Layout: React.FC = () => {
  const [activeItem, setActiveItem] = useState("bodegas");
  const location = useLocation();
  const { user } = useAuth();

  const role = user?.role ?? (user?.landlord ? "landlord" : user?.tenant ? "tenant" : null);

  useEffect(() => {
    const path = location.pathname.toLowerCase();

    if (path.includes("/bodegas")) setActiveItem("bodegas");
    else if (path.includes("/mensajes")) setActiveItem("mensajes");
    else if (path.includes("/solicitudes")) setActiveItem("solicitudes");
    else if (path.includes("/calendario")) setActiveItem("calendario");
    else if (path.includes("/settings")) setActiveItem("settings");
    else if (path.startsWith("/login")) setActiveItem("logout");
  }, [location.pathname]);



  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <SidebarAdmin activeItem={activeItem} setActiveItem={setActiveItem} role={role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <HeaderDashboard role={role} />

        <main className="flex-1 overflow-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
