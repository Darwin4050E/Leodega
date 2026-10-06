import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { LOGO_MIME_TYPES } from "../../utils/organization";

interface Props {
  file: File | null;
  initials: string;
  error?: string;
  onChange: (file: File | null) => void;
}

const OrganizacionLogoPicker = ({ file, initials, error, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (picked) {
      onChange(picked);
    }
  };

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-2">Logo de la organización</span>
      <div className="flex items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_MIME_TYPES.join(",")}
          aria-label="Archivo del logo"
          hidden
          onChange={handlePick}
        />
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Vista previa del logo"
            className="w-[60px] h-[60px] rounded-[14px] object-cover border border-gray-200 shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-[60px] h-[60px] rounded-[14px] bg-[#F5F3FF] border border-dashed border-[#C4B5FD] flex items-center justify-center text-[#7551E9] font-semibold text-xl shrink-0"
          >
            {initials}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
            >
              {file ? "Cambiar foto" : "Subir foto"}
            </button>
            {file && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 m-0">
            PNG o JPG, formato cuadrado. Opcional — si no, usamos las iniciales.
          </p>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default OrganizacionLogoPicker;
