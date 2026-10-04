export type BookingStep = "detail" | "pago" | "comprobante";

interface BookingStepHeaderProps {
  step: BookingStep;
  onClose: () => void;
}

const STEPS: Array<[BookingStep, string]> = [
  ["detail", "Detalle"],
  ["pago", "Pago"],
  ["comprobante", "Comprobante"],
];

/**
 * Step indicator for the `pago`/`comprobante` steps of the checkout flow,
 * fidelity to `BkStepHeader` (`BookingFlow.jsx:438-463`). Does NOT render
 * itself conditionally on `step === 'detail'` — the caller decides not to
 * mount it there (`LeodegaUI`, Slice 4).
 */
export default function BookingStepHeader({ step, onClose }: BookingStepHeaderProps) {
  const currentIndex = STEPS.findIndex(([key]) => key === step);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700"
      >
        Salir
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {STEPS.map(([key, label], index) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  index < currentIndex
                    ? "bg-green-100 text-green-600"
                    : index === currentIndex
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {index < currentIndex ? "✓" : index + 1}
              </span>
              <span
                className={`text-sm ${
                  index === currentIndex ? "font-bold text-gray-900" : "font-medium text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && <span className="h-px w-6 bg-gray-200" />}
          </div>
        ))}
      </div>
    </header>
  );
}
