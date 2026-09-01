import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import FooterNav from "./FooterNav";
import { createStoreRoom, uploadStoreRoomPhotos } from "../../services/storeRooms";
import { useAuth } from "../../context/useAuth";
import ModalConfirmacion from "../../Components/ModalConfirmacion";
import { asApiError } from "../../api/errors";
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';

const PreguntaInicio7 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [politica, setPolitica] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const storedData = localStorage.getItem("optionData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.step7Data?.seguridad && parsed.step7Data?.politica) {
        setSeguridad(parsed.step7Data.seguridad)
        setPolitica(parsed.step7Data?.politica)
      }
    }
  }, []);

  useEffect(() => {
    const existingData = JSON.parse(localStorage.getItem("optionData") || "{}");
    const updatedData = {
      ...existingData,
      step7Data: { seguridad, politica },
    };
    localStorage.setItem("optionData", JSON.stringify(updatedData));
  }, [seguridad, politica]);


  type SeguridadKey = keyof typeof seguridad;

  const handleCheckboxChange = (name: SeguridadKey) => {
    setSeguridad((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const uploadPhotos = async (storeRoomId: number) => {
    const data = JSON.parse(localStorage.getItem("optionData") || "{}");
    if (!data.photos || data.photos.length === 0) return;

    const formData = new FormData();

    for (let i = 0; i < data.photos.length; i++) {
      const base64 = data.photos[i];
      const response = await fetch(base64);
      const blob = await response.blob();
      formData.append("photos[]", blob, `photo_${i}.jpg`);
    }

    await uploadStoreRoomPhotos(storeRoomId, formData);
  };



  const handleEnviar = async () => {
    if (!user?.landlord?.id) {
      alert("No se encontró tu perfil de arrendador. Vuelve a iniciar sesión e intenta de nuevo.");
      return;
    }

    try {
      setIsModalOpen(false);
      setIsProcessing(true);

      const data = JSON.parse(localStorage.getItem("optionData") || "{}");

      const storeRoom = {
        landlord_id: user.landlord.id,
        room_type: data.step1Data?.selectedOption || "",
        storage_type: data.step2Data?.selectedOption || "",
        direction: data.location?.direction || "",
        city: data.location?.city || "",
        size: Number(data.priceData?.tamano) || 0,
        title: data.titleData?.titulo || "",
        description: data.titleData?.descripcion || "",
        security: JSON.stringify(data.step7Data?.seguridad || {}),
        publication_status: "pending",
        publication_date: new Date().toISOString(),

        storePrices: [
          {
            mode: data.priceData?.mode || "month",
            price: Number(data.priceData?.precio) || 0,
            disponibility: true
          }
        ]

      };

      const response = await createStoreRoom(storeRoom);


      if (response.status === 201 || response.status === 200) {
        const storeRoomId = response.data.item?.id ?? response.data.id;
        try {
          await uploadPhotos(storeRoomId);
        } catch (e) {
          console.error("Error subiendo fotos", e);
        }
        setTimeout(() => {
          setIsProcessing(false);
          setIsModalOpen(true);
          localStorage.removeItem("optionData");
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
      setIsProcessing(false)

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

      {/* Contenido principal */}
      <main className="flex flex-col justify-center items-center flex-1 px-6">
        <div className="w-full max-w-2xl text-left mt-[-90px] ">
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

          <h2 className="text-lg font-medium text-gray-800 mb-3 mt-6">
            Define políticas en caso de cancelación u algún problema
          </h2>

          <div className="mb-10">
            <label htmlFor="politica" className="block text-sm font-medium text-gray-700 mb-1">
              Política
            </label>
            <select
              id="politica"
              value={politica}
              onChange={(e) => setPolitica(e.target.value)}
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
            nextDisabled={!politica}
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
