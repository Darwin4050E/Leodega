import { Bell, LogOut, Menu, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from '../img/LOGO_H_1.png';
import { Link } from "react-router-dom";
import { getProfile } from "../services/profile";
import { getUnreadNotificationsCount } from "../services/notifications";
import { useAuth } from "../context/useAuth";
import NotificationsDropdown from "../Dashboard/NotificatiosnDropdown";

const HeaderTendant = () => {
    const { logout } = useAuth();
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [userName, setUserName] = useState(null);
    const [userLastName, setUserLastName] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);


    const toggleNabbar = () => {
        setMobileDrawerOpen(!mobileDrawerOpen);
    }

    useEffect(() => {
        const loadData = async () => {
            try {
                const [profileRes, notifRes] = await Promise.all([
                    getProfile(),
                    getUnreadNotificationsCount(),
                ]);

                setUserName(profileRes.data.name);
                setUserLastName(profileRes.data.lastname);
                setUnreadCount(notifRes.data.count);
            } catch (error) {
                console.error("Error cargando header tenant", error);
            }
        };

        loadData();
    }, []);

    const handleLogout = () => {
        logout();
    };

    const navItems = [
        { label: "Bodegas populares", href: "/storage", path: "/storage" },
        { label: "Mensajes", href: "/arrendatario/mensajes", path: "/arrendatario/mensajes" },
        { label: "Calendario", href: "/arrendatario/calendario", path: "/arrendatario/calendario" }
    ];

    return (
        <nav className="sticky top-0 z-50 py-5 px-12 backdrop-blur-lg border-b border-neutral-300 bg-white">
            <div className="container px-4 mx-auto relative text-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center flex-shrink-0">
                        <Link to="/arrendatario/dashboard" className="flex items-center">
                            <img className="h-10 w-50 mr-2" src={logo} alt="logo" />
                        </Link>
                    </div>

                    <ul className='hidden lg:flex ml-14 space-x-12'>
                        {navItems.map((item, index) => (
                            <li key={index}>
                                <a href={item.href}>{item.label}</a>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden lg:flex justify-center space-x-6 items-center">
                        <div className="py-2 px-5 rounded-md text-white bg-leodega_p text-center flex items-center justify-center space-x-2">
                            <User className="w-6 h-6" />
                            <div className="pl-3 flex flex-col items-start">
                                <span className="text-sm font-medium">{userName || "Usuario"}</span>
                                {userLastName && (
                                    <span className="text-xs opacity-90">{userLastName}</span>
                                )}
                            </div>
                        </div>
                      
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <Bell size={22} />
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
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


                        <Link to="/login" onClick={handleLogout} className="text-center">
                            <LogOut className="inline-block mr-2" size={22} />
                        </Link>
                    </div>

                    <div className="lg:hidden flex items-center space-x-4">
                        <div className="py-1 px-2 rounded-md text-white bg-leodega_p text-center text-sm">
                            <div>{userName || "Usuario"}</div>
                            <div className="text-xs">{userLastName || ""}</div>
                        </div>

                        <button onClick={toggleNabbar}>
                            {mobileDrawerOpen ? <X color='black' /> : <Menu color='black' />}
                        </button>
                    </div>
                </div>

                {mobileDrawerOpen && (
                    <div className="fixed right-0 z-20 bg-white w-full flex flex-col justify-center items-center space-y-6 lg:hidden pt-4 pb-6">
                        <div className="py-2 px-3 rounded-md text-white bg-leodega_p w-40 text-center mb-4">
                            <div>{userName || "Usuario"}</div>
                            <div className="text-sm">{userLastName || ""}</div>
                        </div>

                        <ul className="flex flex-col items-center space-y-6 w-full">
                            {navItems.map((item, index) => (
                                <li key={index} className='py-2 w-full text-center border-b'>
                                    <a href={item.href}>{item.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default HeaderTendant;