import React, { useState } from "react";
import { Upload, AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createReport } from "../services/reports";
import { asApiError } from "../api/errors";


export default function Report() {
  const navigate = useNavigate();
  const { id: storeId } = useParams<{ id: string }>();

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    report_type: "",
    priority: "medium",
    title: "",
    description: "",
  });


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeId) {
      alert("Bodega no válida");
      return;
    }

    if (!form.report_type || !form.title || form.description.length < 20) {
      alert("Complete todos los campos obligatorios (mín. 20 caracteres)");
      return;
    }

    const formData = new FormData();
    formData.append("store_id", storeId);
    formData.append("report_type", form.report_type);
    formData.append("priority", form.priority);
    formData.append("title", form.title);
    formData.append("description", form.description);

    files.forEach(file => {
      formData.append("files[]", file);
    });

    try {
      setLoading(true);
      await createReport(formData);

      alert("Reporte enviado correctamente");
      
      navigate(-1);
    } catch (error: unknown) {
      const err = asApiError(error);
      console.error(err.response?.data || error);
      alert(err.response?.data?.message || "Error al enviar reporte");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gray-50 p-6 flex justify-center">
      <div className="max-w-3xl w-full bg-white p-8 rounded-xl shadow-sm">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 mb-6">
          <ArrowLeft className="w-5 h-5" /> Volver al inicio
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="text-orange-500 w-6 h-6" />
          <div>
            <h1 className="text-xl font-semibold">Reportar Incidente</h1>
            <p className="text-gray-500 text-sm">
              Complete el formulario con toda la información y evidencia disponible
            </p>
          </div>
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Tipo de incidente */}
          <div>
            <label className="font-medium">Tipo de incidente *</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50"
              value={form.report_type}
              onChange={e => setForm({ ...form, report_type: e.target.value })}>
              <option value="">Seleccione el tipo de incidente</option>
              <option value="Infraestructura">Infraestructura</option>
              <option value="Seguridad">Seguridad</option>
              <option value="Acceso">Acceso</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          {/* Nivel de urgencia */}
          <div>
            <label className="font-medium">Nivel de urgencia *</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50"
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
            >
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="low">Baja</option>
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="font-medium">Título del incidente *</label>
            <input
              type="text"
              placeholder="Resumen breve del problema"
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Proporcione un título claro y descriptivo
            </p>
          </div>


          {/* Descripción */}
          <div>
            <label className="font-medium">Descripción detallada *</label>
            <textarea
              placeholder="Describa qué sucedió, cuándo ocurrió, y cualquier información relevante..."
              className="mt-1 w-full border rounded-lg px-3 py-2 h-28"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Incluya todos los detalles relevantes (mínimo 20 caracteres)
            </p>
          </div>

          {/* Evidencia */}
          <div className="border border-dashed rounded-xl p-6 text-center bg-gray-50">
            <input type="file" multiple className="hidden" id="fileUpload" onChange={handleFileUpload} />
            <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-10 h-10 text-gray-400" />
              <p className="mt-2 text-gray-600">Haga clic para cargar archivos o arrastre aquí</p>
              <p className="text-xs text-gray-500">Imágenes, PDF, DOC (Máximo 10MB por archivo)</p>
            </label>

            {files.length > 0 && (
              <div className="mt-4 text-left">
                <p className="font-medium mb-1">Archivos seleccionados:</p>
                <ul className="text-sm text-gray-600 list-disc ml-6">
                  {files.map((file, i) => (
                    <li key={i}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-gray-700">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p>
              Asegúrese de que toda la información sea precisa y completa. Los incidentes críticos
              requieren evidencia fotográfica.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium">
            {loading ? "Enviando reporte..." : "Enviar Reporte"}
          </button>
        </form>
      </div>
    </div>
  );
}
