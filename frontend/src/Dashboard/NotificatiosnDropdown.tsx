import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead, type AppNotification } from "../services/notifications";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

interface NotificationsDropdownProps {
    onUnreadChange: Dispatch<SetStateAction<number>>;
}

const NotificationsDropdown = ({ onUnreadChange }: NotificationsDropdownProps) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        getNotifications().then(res => {
            console.log("Notificaciones:", res.data);
            setNotifications(res.data);
        });
    }, []);

    const handleClick = async (n: AppNotification) => {
        //  marcar como leída
        if (!n.read_at) {
            await markNotificationRead(n.id);
            onUnreadChange((prev: number) => Math.max(prev - 1, 0));
        }

        // REDIRIGIR según tipo
        if (n.type === "store_reported") {
            navigate("/admin/solicitudes");
        }
    };

    return (
        <div className="absolute right-0 top-12 w-80 bg-white shadow-lg rounded-lg border z-50">
            {notifications.map(n => (
                <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                        !n.read_at ? "bg-purple-50" : ""
                    }`}
                >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-gray-500">{n.body}</p>
                </div>
            ))}
        </div>
    );
};

export default NotificationsDropdown;
