import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from './ProgressBar';
import FooterNav from './FooterNav';
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';
import agregarFotos from '../../img/agregarFotos.png';
import { Plus, X } from 'lucide-react';

const PreguntaInicio3: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const MIN_PHOTOS = 5;
  const MAX_PHOTOS = 10;
  const canContinue = files.length >= MIN_PHOTOS && files.length <= MAX_PHOTOS;

  const handleNext = async () => {
    await savePhotosTemp();
    navigate('/preguntainicio4');
  }

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);

      const previews = selectedFiles.map(
        file => URL.createObjectURL(file)
      )
      setImagePreviews((prev) => [...prev, ...previews]);
    }
  };

  const filesToBase64 = (files: File[]) => Promise.all(
    files.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }))
  )

  const savePhotosTemp = async () => {
    const baseFiles = await filesToBase64(files);
    const existingData = JSON.parse(localStorage.getItem("optionData") || "{}");
    localStorage.setItem("optionData", JSON.stringify({
      ...existingData,
      photos: baseFiles
    }));
  };

  const removeImage = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="pt-[30px] mb-[10px] px-[30px] lg:pt-[50px] lg:pb-10 lg:pr-[60px] lg:mb-[2px]">
        <div className="flex items-center gap-3 justify-end">
          <img src={leodegalogo} alt="Logo Leodega" className="h-8 md:h-10 lg:h-12" />
          <img src='/LOGO_LEODEGA TEXTO-19.png' alt="Leodega" className="h-6 md:h-8 lg:h-10" />
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 xl:px-20 pt-[8px]">
                <div className="w-full max-w-4xl text-center lg:text-left pb-28">
          <h1 className="text-[20px] sm:text-[22px] md:text-[24px] lg:text-[26px] xl:text-[28px] font-semibold text-center text-[#1a1a1a] mb-4 mt-2">
            Agrega algunas fotos de tu bodega
          </h1>
  
          <p className="text-center text-[#6b7280] mb-6 md:mb-8 text-[14px] sm:text-[15px] md:text-[16px] px-2">
            Para empezar, necesitarás cinco fotos. Después podrás agregar más o hacer cambios.
          </p>

          <div className="mb-2 sm:mb-4 md:mb- flex justify-center px-2 sm:px-0">
            {imagePreviews.length === 0 ? (
              <button
                type="button"
                onClick={handleImageClick}
                aria-label="Agregar fotos"
                className="w-full max-w-2xl md:max-w-3xl h-auto cursor-pointer rounded-md overflow-hidden"
              >
                <img
                  src={agregarFotos}
                  alt="Agregar Fotos"
                  className=" pt-5 w-full h-auto max-h-[50vh] md:max-h-[60vh] object-contain hover:opacity-80 transition-opacity"
                />
              </button>
            ) : (
              <div className=" relative w-full h-[300px] sm:h-[320px] md:h-[350px] lg:h-[320px] flex items-center justify-center">
                <img
                  src={imagePreviews[0]}
                  alt="Principal subida"
                  className="w-full h-full object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => removeImage(0)}
                  aria-label="Eliminar foto"
                  className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-white/90 rounded-full p-1.5 sm:p-2 shadow-md hover:bg-white"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          
          {imagePreviews.length === 1 && files.length < MAX_PHOTOS && (
            <div className="mb-6 md:mb-8 px-2 sm:px-0">
              <button
                type="button"
                onClick={handleImageClick}
                aria-label="Agregar más fotos"
                className="w-full h-20 sm:h-28 md:h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Plus className="h-8 w-8 text-gray-400" />
              </button>
            </div>
          )}

          {imagePreviews.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-2 mb-6 md:mb-8 px-2 sm:px-0">
              {imagePreviews.slice(1).map((src, index) => (
                <div key={src} className="relative w-full h-24 sm:h-28 md:h-32">
                  <img
                    src={src}
                    alt={`Vista previa ${index + 1}`}
                    className="rounded-lg shadow w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index + 1)}
                    aria-label="Eliminar foto"
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow-md hover:bg-white"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
              ))}
              
              {files.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={handleImageClick}
                  aria-label="Agregar más fotos"
                  className="relative w-full h-24 sm:h-28 md:h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-8 w-8 text-gray-400" />
                </button>
              )}
            </div>
          )}

          <div className="px-4 sm:px-0">
            <ProgressBar totalSteps={7} activeIndex={2} />
          </div>

          <div className="px-4 sm:px-0">
            <FooterNav 
              onBack={() => navigate('/PreguntaInicio2')}
              onNext={handleNext}
              nextDisabled={!canContinue}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreguntaInicio3;