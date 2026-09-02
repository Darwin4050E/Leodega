import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import FooterNav from "./FooterNav";
import { createStoreRoom, uploadStoreRoomPhotos } from "../../services/storeRooms";
import { useAuth } from "../../context/useAuth";
import { useWizard } from "../../context/WizardContext";
import ModalConfirmacion from "../../Components/ModalConfirmacion";
import { asApiError } from "../../api/errors";
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';

const PreguntaInicio7 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const wizardCtx = useWizard();

  const permitInputRef = useRef<HTMLInputElement | null>(null);

  const [seguridad, setSeguridad] = useState<{
    camara: boolean;
    ruido: boolean;
    control: boolean;
    objetos: boolean;
  }>({
    camara: false,
    ruido: false,
    control: false,
    objetos: false,
  });
  const [cancellationPolicyTier, setCancellationPolicyTier] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  type SeguridadKey = keyof typeof seguridad;

  const handleCheckboxChange = (name: SeguridadKey) => {
    setSeguridad((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handlePermitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    wizardCtx.setPermit(file);
  };

  const uploadPhotos = async (storeRoomId: number) => {
    if (!wizardCtx.photos || wizardCtx.photos.length === 0) return;

    const formData = new FormData();
    for (const photo of wizardCtx.photos) {
      formData.append("photos[]", photo);
    }

    await uploadStoreRoomPhotos(storeRoomId, formData);
  };

  // Submit is gated: both a permit and a cancellation policy tier are required.
  const nextDisabled = !cancellationPolicyTier || !wizardCtx.permit;

  const handleEnviar = async () => {
    if (!user?.landlord?.id) {
      alert("No se encontró tu perfil de arrendador. Vuelve a iniciar sesión e intenta de nuevo.");
      return;
    }

    if (!wizardCtx.permit) {
      alert("Debes adjuntar el permiso de bomberos vigente para continuar.");
      return;
    }

    try {
      setIsModalOpen(false);
      setIsProcessing(true);

      const data = JSON.parse(localStorage.getItem("optionData") || "{}");

      const formData = new FormData();
      formData.append("room_type", data.step1Data?.selectedOption || "");
      formData.append("storage_type", data.step2Data?.selectedOption || "");
      formData.append("direction", data.location?.direction || "");
      formData.append("city", data.location?.city || "");
      formData.append("size", String(Number(data.priceData?.tamano) || 0));
      formData.append("title", data.titleData?.titulo || "");
      formData.append("description", data.titleData?.descripcion || "");
      formData.append("security", JSON.stringify(seguridad));
      formData.append("cancellation_policy_tier", cancellationPolicyTier);
      formData.append("firefighter_permit", wizardCtx.permit);

      formData.append("storePrices[0][mode]", "month");
      formData.append("storePrices[0][price]", String(Number(data.priceData?.precio) || 0));
      formData.append("storePrices[0][disponibility]", "true");

      const response = await createStoreRoom(formData);

      if (response.status === 201 || response.status === 200) {
        const storeRoomId = response.data.item?.id ?? response.data.id;

        try {
          await uploadPhotos(storeRoomId);
        } catch (e) {
          console.error("Error subiendo fotos", e);
        }

        wizardCtx.reset();
        localStorage.removeItem("optionData");

        setTimeout(() => {
          setIsProcessing(false);
          setIsModalOpen(true);
        }, 1500);
      }
    } catch (error: unknown) {
      console.error("Error al crear la bodega:", error);
      const apiError = asApiError(error);
      const firstFieldError = apiError.response?.data?.errors
        ? Object.values(apiError.response.data.errors)[0]?.[0]
        : undefined;
      const message =
        firstFieldError ||
        apiError.response?.data?.message ||
        apiError.response?.data?.error ||
        "Error al enviar la solicitud, vuelve a intentar";
      alert(message);
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    setIsModalOpen(false);
    navigate("/arrendador/bodegas");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex justify-end items-center gap-3 p-6">
        <img
          src={leodegalogo}
          alt="Logo Leodega"
          className="h-10"
        />
        <img
          src='/LOGO_LEODEGA TEXTO-19.png'
          alt="Leodega"
          className="h-8"
        />
      </header>

      {/* Main content */}
      <main className="flex flex-col justify-center items-center flex-1 px-6">
        <div className="w-full max-w-2xl text-left mt-[-90px]">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-6 text-center">
            Comparte información de seguridad
          </h1>

          <h2 className="text-lg font-medium text-gray-800 mb-4">
            ¿Tu alojamiento tiene alguno de estos?
          </h2>

          <div className="space-y-3 mb-6">
            <label className="flex justify-between items-center border-b border-gray-100 py-2 text-gray-700">
              <span>Hay una cámara de seguridad exterior</span>
              <input
                type="checkbox"
                checked={seguridad.camara}
                onChange={() => handleCheckboxChange("camara")}
                className="w-5 h-5 accent-purple-500 cursor-pointer"
              />
            </label>

            <label className="flex justify-between items-center border-b border-gray-100 py-2 text-gray-700">
              <span>Monitor de decibeles de ruido presente</span>
              <input
                type="checkbox"
                checked={seguridad.ruido}
                onChange={() => handleCheckboxChange("ruido")}
                className="w-5 h-5 accent-purple-500 cursor-pointer"
              />
            </label>

            <label className="flex justify-between items-center border-b border-gray-100 py-2 text-gray-700">
              <span>Control de plagas y humedad</span>
              <input
                type="checkbox"
                checked={seguridad.control}
                onChange={() => handleCheckboxChange("control")}
                className="w-5 h-5 accent-purple-500 cursor-pointer"
              />
            </label>

            <label className="flex justify-between items-center border-b border-gray-100 py-2 text-gray-700">
              <span>
                Objetos prohibidos (sustancias peligrosas, inflamables, ilegales,
                perecibles, etc.)
              </span>
              <input
                type="checkbox"
                checked={seguridad.objetos}
                onChange={() => handleCheckboxChange("objetos")}
                className="w-5 h-5 accent-purple-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Fire-department permit upload — REQUIRED */}
          <h2 className="text-lg font-medium text-gray-800 mb-3 mt-6">
            Permiso de bomberos <span className="text-red-500">*</span>
          </h2>

          <div className="mb-6">
            <input
              ref={permitInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePermitFileChange}
              className="hidden"
            />

            {wizardCtx.permit ? (
              <div className="flex items-center gap-3 p-3 border border-green-400 rounded-lg bg-green-50">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-green-800 font-medium truncate">
                  {wizardCtx.permit.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    wizardCtx.setPermit(null);
                    if (permitInputRef.current) permitInputRef.current.value = "";
                  }}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                  aria-label="Eliminar permiso"
                >
                  &#x2715;
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => permitInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm text-gray-600"
              >
                Seleccionar archivo PDF (máx. 10 MB)
              </button>
            )}
          </div>

          {/* Cancellation policy tier — REQUIRED */}
          <h2 className="text-lg font-medium text-gray-800 mb-3 mt-6">
            Define políticas en caso de cancelación u algún problema
          </h2>

          <div className="mb-10">
            <label htmlFor="cancellationPolicyTier" className="block text-sm font-medium text-gray-700 mb-1">
              Política <span className="text-red-500">*</span>
            </label>
            <select
              id="cancellationPolicyTier"
              value={cancellationPolicyTier}
              onChange={(e) => setCancellationPolicyTier(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Selecciona Política</option>
              <option value="flexible">Flexible</option>
              <option value="moderada">Moderada</option>
              <option value="estricta">Estricta</option>
            </select>
          </div>

          <ProgressBar totalSteps={7} activeIndex={6} />

          <FooterNav
            onBack={() => navigate('/PreguntaInicio6')}
            onNext={handleEnviar}
            nextDisabled={nextDisabled}
            nextLabel={"Enviar Solicitud"}
          />

          <ModalConfirmacion
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            titulo="Tu solicitud ha sido enviada, se te notificará cuando haya una respuesta"
            mensaje=""
            textoBoton="Aceptar"
            onConfirm={handleConfirm}
          />
        </div>
      </main>

      {isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm z-50">
          <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-lg font-medium text-gray-700">Procesando solicitud...</p>
        </div>
      )}
    </div>
  );
};

export default PreguntaInicio7;
