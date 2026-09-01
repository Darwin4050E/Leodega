import { motion, AnimatePresence } from "framer-motion";

interface ModalConfirmacionProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  mensaje?: string;
  textoBoton?: string;
  onConfirm: () => void;
}

const ModalConfirmacion = ({
  isOpen,
  onClose,
  titulo,
  mensaje,
  textoBoton = "Aceptar",
  onConfirm,
}: ModalConfirmacionProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl p-8 w-[90%] max-w-md text-center relative overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            {/* Icono de check animado */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                className="bg-green-100 rounded-full p-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-10 h-10 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {titulo}
            </h2>

            {mensaje && (
              <p className="text-gray-500 mb-6 text-sm sm:text-base">
                {mensaje}
              </p>
            )}

            <motion.button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="bg-purple-600 text-white w-full py-3 rounded-xl font-medium hover:bg-purple-700 shadow-md hover:shadow-lg transition-all"
              whileTap={{ scale: 0.97 }}
            >
              {textoBoton}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModalConfirmacion;
