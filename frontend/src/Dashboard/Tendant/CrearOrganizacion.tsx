import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

import HeaderTendant from "../../Components/HeaderTendant";
import { useAuth } from "../../context/useAuth";
import { asApiError } from "../../api/errors";
import { createOrganization, type Organization } from "../../services/organizations";
import {
  organizationInitials,
  validateLogoFile,
  validateOrganizationForm,
  type OrganizationFormErrors,
} from "../../utils/organization";
import OrganizacionLogoPicker from "./OrganizacionLogoPicker";
import OrganizacionCreadaPanel from "./OrganizacionCreadaPanel";

const TENANT_HOME = "/arrendatario/dashboard";
const CREATE_ERROR_FALLBACK = "No se pudo crear la organización. Intenta nuevamente";
const FIELDS = ["name", "ruc", "email", "logo"] as const;

const INPUT_CLASS =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#7551E9]";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}

const Field = ({ id, label, value, placeholder, error, hint, onChange }: FieldProps) => {
  const helpId = `${id}-help`;
  const help = error ?? hint;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
      {help && (
        <p id={helpId} className={`mt-1.5 text-xs ${error ? "text-red-600" : "text-gray-400"}`}>
          {help}
        </p>
      )}
    </div>
  );
};

const CrearOrganizacion = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ruc, setRuc] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<OrganizationFormErrors>({});
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Organization | null>(null);

  if (user?.role !== "tenant") {
    return <Navigate to="/" replace />;
  }

  const clearError = (field: keyof OrganizationFormErrors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleLogoChange = (file: File | null) => {
    if (!file) {
      setLogo(null);
      clearError("logo");
      return;
    }
    const problem = validateLogoFile(file);
    if (problem) {
      setErrors((prev) => ({ ...prev, logo: problem }));
      return;
    }
    setLogo(file);
    clearError("logo");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const formErrors = validateOrganizationForm({ name, ruc, email });
    if (Object.keys(formErrors).length > 0) {
      setErrors((prev) => ({ ...formErrors, logo: prev.logo }));
      return;
    }

    setErrors({});
    setBanner("");
    setSubmitting(true);
    try {
      const response = await createOrganization({
        name: name.trim(),
        ruc: ruc.trim(),
        email: email.trim(),
        logo,
      });
      setCreated(response.data.organization);
    } catch (error) {
      const apiError = asApiError(error);
      const serverErrors = apiError.response?.data?.errors;
      const fieldErrors: OrganizationFormErrors = {};
      if (apiError.response?.status === 422 && serverErrors) {
        FIELDS.forEach((field) => {
          const message = serverErrors[field]?.[0];
          if (message) fieldErrors[field] = message;
        });
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      } else {
        setBanner(apiError.response?.data?.message || CREATE_ERROR_FALLBACK);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // HUE-02 fills this seam with the active-organization context; until then it only leaves the page.
  const handleOperate = () => navigate(TENANT_HOME);

  return (
    <>
      <HeaderTendant />
      <div className="px-6 py-8 bg-[#F5F6FA] min-h-screen">
        <div className="max-w-[560px] mx-auto">
          {created ? (
            <OrganizacionCreadaPanel
              organization={created}
              onPersonal={() => navigate(TENANT_HOME)}
              onOperate={handleOperate}
            />
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-7 pt-6 pb-5 border-b border-gray-100 flex gap-4 items-start">
                <div className="w-[46px] h-[46px] rounded-xl bg-[#F5F3FF] flex items-center justify-center shrink-0">
                  <Building2 size={23} color="#7551E9" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 m-0 mb-1">Crear organización</h1>
                  <p className="text-sm text-gray-500 m-0">
                    Registra tu empresa para reservar bodegas a su nombre. Queda <b>activa de inmediato</b>,
                    sin aprobación manual.
                  </p>
                </div>
              </div>
              <div className="px-7 pt-6 pb-2 flex flex-col gap-5">
                {banner && (
                  <div role="alert" className="px-3.5 py-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {banner}
                  </div>
                )}
                <OrganizacionLogoPicker
                  file={logo}
                  initials={organizationInitials(name)}
                  error={errors.logo}
                  onChange={handleLogoChange}
                />
                <Field
                  id="organization-name"
                  label="Razón social"
                  value={name}
                  placeholder="Ej. Importadora Andina S.A."
                  error={errors.name}
                  onChange={(value) => {
                    setName(value);
                    clearError("name");
                  }}
                />
                <Field
                  id="organization-ruc"
                  label="RUC"
                  value={ruc}
                  placeholder="13 dígitos — Ej. 1792146739001"
                  error={errors.ruc}
                  hint="Debe tener 13 dígitos y terminar en 001."
                  onChange={(value) => {
                    setRuc(value.replace(/\D/g, "").slice(0, 13));
                    clearError("ruc");
                  }}
                />
                <Field
                  id="organization-email"
                  label="Correo de la organización"
                  value={email}
                  placeholder="operaciones@empresa.com"
                  error={errors.email}
                  onChange={(value) => {
                    setEmail(value);
                    clearError("email");
                  }}
                />
              </div>
              <div className="px-7 pt-5 pb-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => navigate(TENANT_HOME)}
                  className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#7551E9] text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  Crear organización
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default CrearOrganizacion;
