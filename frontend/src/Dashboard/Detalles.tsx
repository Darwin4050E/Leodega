import { HeaderDashboard } from "./HeaderDashboard"
import HeaderTendant from "../Components/HeaderTendant";
import LeodegaUI from "../Components/LeodegaUI";
import { useAuth } from "../context/useAuth";

const Detalles: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* The route is public: HeaderTendant loads the profile and
                notifications, so only a signed-in tenant gets it. */}
            {user?.role === "tenant" ? <HeaderTendant /> : <HeaderDashboard />}
            <LeodegaUI />

        </div>
    )
}

export default Detalles;
