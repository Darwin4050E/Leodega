import { Bell, ChevronDown } from "lucide-react";
import React, { useState, useEffect } from 'react';
import perfil from '../img/perfil.jpg';
import { getProfile } from "../services/profile";
import { getUnreadNotificationsCount } from "../services/notifications";
import NotificationsDropdown from "./NotificatiosnDropdown";

type RoleType = "admin" | "landlord" | "tenant";
interface HeaderDashboardProps {
    role?: RoleType | null;
}



export const HeaderDashboard: React.FC<HeaderDashboardProps> = ({ role }) => {
    const roleLabel =
        role === "admin"
            ? "Administrador"
            : role === "landlord"
                ? "Arrendador"
                : role === "tenant"
                    ? "Arrendatario"
                    : "Usuario";

    const [unreadCount, setUnreadCount] = useState(0);

    const [nombre, setNombre] = useState("");
    const [apellido, setApellido] = useState("");
    const [showNotifications, setShowNotifications] = useState(false);


    useEffect(() => {
        const loadData = async () => {
            try {
                const [profileRes, notifRes] = await Promise.all([
                    getProfile(),
                    getUnreadNotificationsCount(),
                ]);

                setNombre(profileRes.data.name);
                setApellido(profileRes.data.lastname);
                setUnreadCount(notifRes.data.count);
            } catch (error) {
                console.error("Error loading header data", error);
            }
        };


        loadData();
    }, []);


    return (
        <header className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between h-[72px]">
            <div className="flex-1 max-w-md invisible">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar"
                        className="w-full px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />

                </div>
            </div>

            <div className="flex items-center gap-6 relative">
                <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </button>

                {showNotifications && (
                    <NotificationsDropdown
                        onClose={() => setShowNotifications(false)}
                        onUnreadChange={setUnreadCount}
                    />
                )}

                <button className="flex items-center gap-3 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                    <img
                        src={perfil}
                        className="w-9 h-9 rounded-full object-cover"
                    />
                    <div className="text-left">
                        <p className="text-sm font-medium text-gray-800"> {nombre} {apellido}</p>
                        <p className="text-xs text-gray-500">{roleLabel}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
            </div>
        </header>
    );
};
