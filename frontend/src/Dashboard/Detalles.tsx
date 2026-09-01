import { HeaderDashboard } from "./HeaderDashboard"
import LeodegaUI from "../Components/LeodegaUI";

const Detalles: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <HeaderDashboard />
            <LeodegaUI />

        </div>
    )
}

export default Detalles;


