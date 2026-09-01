import React, { useState } from "react";
import { SidebarItem } from "./SidebarItem";
import { useNavigate } from 'react-router-dom';
import logoh1 from '../img/LOGO_H_1.png';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';

interface SidebarAdminProps {
    readonly activeItem: string;
    readonly setActiveItem: React.Dispatch<React.SetStateAction<string>>;
    role?: "admin" | "landlord" | "tenant";
}

export default function SidebarAdmin(
    props: Readonly<SidebarAdminProps>
) {
    const { activeItem, setActiveItem, role } = props;
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const { logout } = useAuth();
    const basePath =
        role === "admin"
            ? "/admin"
            : role === "landlord"
                ? "/arrendador"
                : role === "tenant"
                    ? "/arrendatario"
                    : "";
    

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleItemClick = (callback: () => void) => {
        callback();
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const sidebar = document.getElementById('sidebar');
            const menuButton = document.getElementById('menu-button');

            if (isSidebarOpen &&
                sidebar &&
                !sidebar.contains(event.target as Node) &&
                menuButton &&
                !menuButton.contains(event.target as Node)) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSidebarOpen]);

    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    


    return (
        <>
            <button
                id="menu-button"
                onClick={toggleSidebar}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
                aria-label={isSidebarOpen ? "Cerrar menú" : "Abrir menú"}
            >
                {isSidebarOpen ? <X size={0} /> : <Menu size={24} />}
            </button>

            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside
                id="sidebar"
                className={`
                    fixed lg:sticky top-0 left-0 
                    w-[270px] bg-white border-r border-gray-200 
                    flex flex-col flex-shrink-0 min-h-screen
                    transform transition-transform duration-300 ease-in-out
                    z-40
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                <div className="px-6 py-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <img src={logoh1} alt="Logo" className="h-12" />
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-1 rounded hover:bg-gray-100"
                        aria-label="Cerrar menú"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 py-6 overflow-y-auto">
                    <SidebarItem
                        label="Bodegas"
                        active={activeItem === 'bodegas'}
                        onClick={() => handleItemClick(() => {
                            setActiveItem('bodegas');
                            navigate(`${basePath}/bodegas`);
                        })}
                    />

                    <SidebarItem
                        label="Solicitudes"
                        active={activeItem === 'solicitudes'}
                        onClick={() => handleItemClick(() => {
                            setActiveItem('solicitudes');
                            navigate(`${basePath}/solicitudes`);
                        })}
                    />

                    <SidebarItem
                        label="Mensajes"
                        active={activeItem === 'mensajes'}
                        onClick={() => handleItemClick(() => {
                            setActiveItem('mensajes');
                            navigate(`${basePath}/mensajes`);

                        })}
                    />

                    <div className="mt-8 mb-3 px-6">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                            Páginas
                        </p>
                    </div>

                    {role === "landlord" && (
                        <SidebarItem
                            label="Calendario"
                            active={activeItem === "calendario"}
                            onClick={() => handleItemClick(() => {
                                setActiveItem("calendario");
                                navigate(`${basePath}/calendario`);
                            })}
                        />
                    )}

                    <SidebarItem
                        label="Configuración"
                        active={activeItem === 'settings'}
                        onClick={() => handleItemClick(() => {
                            setActiveItem('settings');
                            navigate(`${basePath}/settings`);
                        })}
                    />

                    <SidebarItem
                        label="Cerrar sesión"
                        active={activeItem === 'logout'}
                        onClick={() => handleItemClick(() => {
                            logout();
                            setActiveItem('logout');
                            navigate('/login', { replace: true });
                        })}
                    />
                </nav>
            </aside>

            {!isSidebarOpen && <div className="lg:hidden min-h-[60px]"></div>}
        </>
    );
}