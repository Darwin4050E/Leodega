import { createContext, useContext, useState, type ReactNode } from "react";

export interface WizardContextValue {
  photos: File[];
  setPhotos: (files: File[]) => void;
  permit: File | null;
  setPermit: (file: File | null) => void;
  reset: () => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [permit, setPermit] = useState<File | null>(null);

  const reset = () => {
    setPhotos([]);
    setPermit(null);
  };

  return (
    <WizardContext.Provider value={{ photos, setPhotos, permit, setPermit, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useWizard must be used inside WizardProvider");
  }
  return ctx;
}
