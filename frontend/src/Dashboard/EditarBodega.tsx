import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { getStoreRoomDetail, updateStoreRoom } from "../services/storeRooms";
import { asApiError } from "../api/errors";

/**
 * HUG-08: single-page edit form for a storeroom the gestor already
 * published. Editable fields only: title, description, size (dimensiones),
 * the monthly price (tarifa mensual) and its disponibility toggle.
 *
 * The 7-step creation wizard is deliberately NOT reused: its
 * localStorage['optionData'] design makes seeding from an existing room
 * error-prone and risks contaminating a later "create" flow.
 *
 * Prefill comes from GET /store-rooms/:id/detail (getStoreRoomDetail); the
 * monthly tariff is the store_prices row with mode === 'month'.
 * Save hits PUT /storeRooms/:id (updateStoreRoom) with only the fields that
 * actually changed.
 */

const SUCCESS_MESSAGE = "Los cambios se guardaron correctamente.";

interface FormState {
  title: string;
  description: string;
  size: string;
  price: string;
  disponibility: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  size: "",
  price: "",
  disponibility: true,
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EditarBodega = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const [hasMonthlyPrice, setHasMonthlyPrice] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;

    const fetchRoom = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await getStoreRoomDetail(id);
        if (!active) return;

        const monthly = data.prices?.find((p) => p.mode === "month");
        const prefilled: FormState = {
          title: data.title ?? "",
          description: data.description ?? "",
          size: data.size != null ? String(data.size) : "",
          price: monthly ? String(monthly.price) : "",
          disponibility: monthly ? Boolean(Number(monthly.disponibility)) : true,
        };

        setForm(prefilled);
        setInitialForm(prefilled);
        setHasMonthlyPrice(Boolean(monthly));
      } catch (error) {
        if (!active) return;
        const status = asApiError(error).response?.status;
        if (status === 403) {
          setLoadError("No tienes permiso para editar esta bodega.");
        } else if (status === 404) {
          setLoadError("La bodega no existe o fue eliminada.");
        } else {
          setLoadError("No se pudo cargar la información de la bodega.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRoom();
    return () => {
      active = false;
    };
  }, [id]);

  const isDirty = useMemo(
    () => (Object.keys(form) as (keyof FormState)[]).some((key) => form[key] !== initialForm[key]),
    [form, initialForm]
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSuccessMessage("");
    setNoticeMessage("");
    setServerError("");
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};

    if (form.title.trim() === "") {
      next.title = "El título es obligatorio.";
    }

    const size = Number(form.size);
    if (form.size.trim() === "" || Number.isNaN(size) || size <= 0) {
      next.size = "Las dimensiones deben ser un número mayor a 0.";
    }

    const priceTouched = form.price.trim() !== "" || hasMonthlyPrice;
    if (priceTouched) {
      const price = Number(form.price);
      if (form.price.trim() === "") {
        next.price = "La tarifa mensual es obligatoria.";
      } else if (Number.isNaN(price) || price <= 0) {
        next.price = "La tarifa mensual debe ser mayor a 0.";
      }
    }

    return next;
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};

    if (form.title.trim() !== initialForm.title.trim()) payload.title = form.title.trim();
    if (form.description !== initialForm.description) payload.description = form.description;
    if (form.size !== initialForm.size) payload.size = Number(form.size);

    if (hasMonthlyPrice) {
      if (form.price !== initialForm.price) payload.price = Number(form.price);
      if (form.disponibility !== initialForm.disponibility) payload.disponibility = form.disponibility;
    }

    return payload;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage("");
    setNoticeMessage("");
    setServerError("");

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      setServerError("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await updateStoreRoom(id as string, payload);
      setSuccessMessage(data?.message || SUCCESS_MESSAGE);
      if (data?.notice) setNoticeMessage(data.notice);
      setErrors({});
      setInitialForm({ ...form });
    } catch (error) {
      const apiError = asApiError(error);
      const status = apiError.response?.status;
      const fieldErrors = apiError.response?.data?.errors;

      if (status === 400 && fieldErrors) {
        const mapped: FieldErrors = {};
        (Object.keys(fieldErrors) as (keyof FormState)[]).forEach((key) => {
          const messages = fieldErrors[key];
          if (Array.isArray(messages) && messages.length > 0) {
            mapped[key] = messages.join(" ");
          }
        });
        setErrors(mapped);
        setServerError("Revisa los campos marcados y vuelve a intentarlo.");
      } else if (status === 403) {
        setServerError("No tienes permiso para editar esta bodega.");
      } else if (status === 404) {
        setServerError("La bodega no existe o fue eliminada.");
      } else {
        setServerError(
          apiError.response?.data?.message || "Ocurrió un error al guardar los cambios."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (field: keyof FormState) =>
    `w-full px-4 py-2.5 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
      errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <div className="px-4 lg:pl-8 lg:pr-8 pt-5 bg-[#f5f6fa] min-h-screen">
      <button
        type="button"
        onClick={() => navigate("/arrendador/bodegas")}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a mis bodegas
      </button>

      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Editar bodega</h1>

      {loading && <div className="text-center py-10 text-gray-500">Cargando bodega...</div>}

      {!loading && loadError && (
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loading && !loadError && (
        <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-5">
          {successMessage && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {successMessage}
            </div>
          )}

          {noticeMessage && (
            <div
              role="status"
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
            >
              {noticeMessage}
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Título
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              aria-invalid={Boolean(errors.title)}
              className={inputClass("title")}
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              aria-invalid={Boolean(errors.description)}
              className={inputClass("description")}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          <div>
            <label htmlFor="size" className="block text-sm font-medium text-gray-700 mb-1">
              Dimensiones (m²)
            </label>
            <input
              id="size"
              type="number"
              min="0"
              step="any"
              value={form.size}
              onChange={(e) => setField("size", e.target.value)}
              aria-invalid={Boolean(errors.size)}
              className={inputClass("size")}
            />
            {errors.size && <p className="mt-1 text-xs text-red-600">{errors.size}</p>}
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Tarifa mensual (USD)
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="any"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              aria-invalid={Boolean(errors.price)}
              disabled={!hasMonthlyPrice}
              className={`${inputClass("price")} ${
                !hasMonthlyPrice ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
              }`}
            />
            {!hasMonthlyPrice && (
              <p className="mt-1 text-xs text-gray-500">
                Esta bodega no tiene una tarifa mensual configurada.
              </p>
            )}
            {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="disponibility"
              type="checkbox"
              checked={form.disponibility}
              onChange={(e) => setField("disponibility", e.target.checked)}
              disabled={!hasMonthlyPrice}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="disponibility" className="text-sm text-gray-700">
              Disponible para nuevas reservas
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/arrendador/bodegas")}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
            >
              {successMessage ? "Volver a mis bodegas" : "Cancelar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EditarBodega;
