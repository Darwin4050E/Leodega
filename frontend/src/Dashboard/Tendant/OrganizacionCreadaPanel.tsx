import { Check } from "lucide-react";
import type { Organization } from "../../services/organizations";
import { organizationInitials, organizationShortName } from "../../utils/organization";

interface Props {
  organization: Organization;
  onPersonal: () => void;
  onOperate: () => void;
}

const OrganizacionCreadaPanel = ({ organization, onPersonal, onOperate }: Props) => (
  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden text-center">
    <div className="px-9 pt-10 pb-2">
      <div className="w-[70px] h-[70px] rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
        <Check size={34} color="#16A34A" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 m-0 mb-2">Organización creada correctamente</h1>
      <p className="text-sm text-gray-500 m-0 mx-auto max-w-sm">
        Ya puedes operar en nombre de <b className="text-gray-700">{organization.name}</b>. Quedó{" "}
        <b className="text-green-600">activa</b> al instante y tú eres su administrador.
      </p>
    </div>
    <div className="mx-9 mt-6 px-4 py-4 bg-[#F5F6FA] border border-gray-200 rounded-xl flex items-center gap-3.5 text-left">
      {organization.logo ? (
        <img
          src={organization.logo}
          alt={`Logo de ${organization.name}`}
          className="w-[46px] h-[46px] rounded-xl object-cover border border-gray-200 shrink-0"
        />
      ) : (
        <div className="w-[46px] h-[46px] rounded-xl bg-[#F5F3FF] flex items-center justify-center text-[#7551E9] font-semibold shrink-0">
          {organizationInitials(organization.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{organization.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">RUC {organization.ruc}</div>
      </div>
    </div>
    <div className="px-9 pt-5 pb-8 flex gap-3 justify-center flex-wrap">
      <button
        type="button"
        onClick={onPersonal}
        className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
      >
        Seguir en modo personal
      </button>
      <button
        type="button"
        onClick={onOperate}
        className="px-5 py-2.5 bg-[#7551E9] text-white rounded-lg text-sm font-semibold"
      >
        Operar como {organizationShortName(organization.name)}
      </button>
    </div>
  </div>
);

export default OrganizacionCreadaPanel;
