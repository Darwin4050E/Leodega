import React, { useState } from "react";
import { X } from "lucide-react";

interface LightboxProps {
  photos: string[];
}

/**
 * Large cover photo (click-to-enlarge) followed by an up-to-4 thumbnail
 * strip, matching the prototype's `ADExpediente` visual column
 * (`AdminPanel.jsx:432-441`) rather than a uniform photo grid. The
 * fullscreen overlay mechanism and `z-90` stacking are unchanged.
 */
const Lightbox: React.FC<LightboxProps> = ({ photos }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return <p className="text-sm text-gray-400">Sin fotos adjuntas.</p>;
  }

  const cover = photos[0];
  const thumbnails = photos.slice(1, 5);

  return (
    <>
      <button
        type="button"
        onClick={() => setActiveIndex(0)}
        className="w-full h-60 rounded-xl overflow-hidden bg-gray-100 block mb-2"
      >
        <img src={cover} alt="Portada" className="w-full h-full object-cover" />
      </button>

      {thumbnails.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {thumbnails.map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setActiveIndex(index + 1)}
              className="h-16 rounded-lg overflow-hidden bg-gray-100"
            >
              <img
                src={photo}
                alt={`Foto ${index + 2}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {activeIndex !== null && (
        <div
          onClick={() => setActiveIndex(null)}
          className="fixed inset-0 bg-black/85 z-[90] flex flex-col items-center justify-center gap-4 p-6"
        >
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-white"
          >
            <X size={28} />
          </button>
          <img
            src={photos[activeIndex]}
            alt={`Foto ${activeIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[76vh] object-contain rounded-xl"
          />
          <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
            {photos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`w-14 h-10 rounded-lg overflow-hidden border-2 ${
                  index === activeIndex ? "border-white" : "border-transparent opacity-60"
                }`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default Lightbox;
