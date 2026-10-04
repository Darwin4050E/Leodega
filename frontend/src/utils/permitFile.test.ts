import { describe, it, expect } from "vitest";
import { PERMIT_MAX_BYTES, validatePermitFile } from "./permitFile";

function pdfOfSize(bytes: number, type = "application/pdf") {
  const file = new File(["x"], "permiso.pdf", { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

describe("validatePermitFile", () => {
  it("accepts a PDF up to the 5 MB limit", () => {
    expect(PERMIT_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(validatePermitFile(pdfOfSize(PERMIT_MAX_BYTES))).toBeNull();
  });

  it("rejects a non-PDF file", () => {
    expect(validatePermitFile(pdfOfSize(10, "image/png"))).toBe("El permiso debe ser un archivo PDF.");
  });

  it("rejects a PDF over 5 MB", () => {
    expect(validatePermitFile(pdfOfSize(PERMIT_MAX_BYTES + 1))).toBe("El permiso no debe superar los 5 MB.");
  });
});
