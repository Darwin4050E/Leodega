import { useNavigate } from "react-router-dom";
import {
    getNotifications,
    markNotificationRead,
    hasPaidReservationData,
    hasExpiredReservationData,
    type AppNotification,
} from "../services/notifications";
import { formatUSD } from "../utils/money";
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
        if (!n.is_read) {
            await markNotificationRead(n.id);
            onUnreadChange((prev: number) => Math.max(prev - 1, 0));
        }

        // REDIRIGIR según tipo
        if (n.type === "store_reported") {
            navigate("/admin/solicitudes");
        } else if (n.type === "reservation_booked_and_paid" || n.type === "reservation_expired") {
            navigate("/arrendador/solicitudes");
        }
    };

    return (
        <div className="absolute right-0 top-12 w-80 bg-white shadow-lg rounded-lg border z-50">
            {notifications.map(n => (
                <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                        !n.is_read ? "bg-purple-50" : ""
                    }`}
                >
                    {hasPaidReservationData(n) ? (
                        <>
                            <p className="text-sm font-medium">{n.data.customer_name}</p>
                            <p className="text-xs text-gray-500">{n.data.store_room_title}</p>
                            <p className="text-xs text-gray-500">
                                {formatUSD(n.data.amount)} · {n.data.start_date} - {n.data.end_date}
                            </p>
                        </>
                    ) : hasExpiredReservationData(n) ? (
                        <>
                            <p className="text-sm font-medium">{n.data.customer_name}</p>
                            <p className="text-xs text-gray-500">{n.data.store_room_title}</p>
                            <p className="text-xs text-gray-500">
                                {n.data.start_date} - {n.data.end_date}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className="text-xs text-gray-500">{n.body}</p>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

export default NotificationsDropdown;
