export type DetailStatusVariant = "loading" | "not-found" | "error";

interface DetailStatusScreenProps {
  variant: DetailStatusVariant;
  onBack: () => void;
}

const COPY: Record<Exclude<DetailStatusVariant, "loading">, string> = {
  "not-found": "Esta bodega no existe o ya no está disponible",
  error:
    "No se pudo cargar la información de esta bodega. Verifica tu conexión e inténtalo de nuevo.",
};

/**
 * Shared loading/not-found/error screen for the storeroom detail routes.
 * The `not-found` and `error` variants render DIFFERENT copy (obs #247
 * overrides design #246 decision 3 on this point): a network/server error
 * must not tell the user the room "no existe" when its existence is simply
 * unknown. `onBack` is always the caller's role-branched `handleVolver` —
 * never a hardcoded path — so the back link works correctly on all three
 * mounting routes.
 */
const DetailStatusScreen: React.FC<DetailStatusScreenProps> = ({ variant, onBack }) => {
  return (
    <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm text-gray-700 text-center">
        {variant === "loading" ? (
          <p>Cargando...</p>
        ) : (
          <>
            <p className="mb-4">{COPY[variant]}</p>
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DetailStatusScreen;
