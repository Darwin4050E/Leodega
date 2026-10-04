import { describe, it, expect } from "vitest";
import { parseSecurityFeatures, SECURITY_LABELS } from "./security";

describe("parseSecurityFeatures", () => {
  it("resolves all four keys to true when the JSON has all of them true", () => {
    const result = parseSecurityFeatures(
      JSON.stringify({ camara: true, ruido: true, control: true, acceso: true })
    );

    expect(result).toEqual({ camara: true, ruido: true, control: true, acceso: true });
  });

  it("resolves a mix of true/false keys individually", () => {
    const result = parseSecurityFeatures(
      JSON.stringify({ camara: true, ruido: false, control: true, acceso: false })
    );

    expect(result).toEqual({ camara: true, ruido: false, control: true, acceso: false });
  });

  it("resolves all false when the raw value is undefined", () => {
    const result = parseSecurityFeatures(undefined);

    expect(result).toEqual({ camara: false, ruido: false, control: false, acceso: false });
  });

  it("resolves all false when the raw value is null", () => {
    const result = parseSecurityFeatures(null);

    expect(result).toEqual({ camara: false, ruido: false, control: false, acceso: false });
  });

  it("resolves all false when the raw value is an empty string", () => {
    const result = parseSecurityFeatures("");

    expect(result).toEqual({ camara: false, ruido: false, control: false, acceso: false });
  });

  it("resolves all false without throwing when the raw value is malformed JSON", () => {
    expect(() => parseSecurityFeatures("{not json")).not.toThrow();
    expect(parseSecurityFeatures("{not json")).toEqual({
      camara: false,
      ruido: false,
      control: false,
      acceso: false,
    });
  });

  it("resolves all false when the raw value parses to a non-object shape", () => {
    expect(parseSecurityFeatures(JSON.stringify(["camara", "ruido"]))).toEqual({
      camara: false,
      ruido: false,
      control: false,
      acceso: false,
    });
    expect(parseSecurityFeatures(JSON.stringify("just a string"))).toEqual({
      camara: false,
      ruido: false,
      control: false,
      acceso: false,
    });
  });

  it("never uses the legacy `objetos` key", () => {
    const result = parseSecurityFeatures(JSON.stringify({ objetos: true }));

    expect(result).toEqual({ camara: false, ruido: false, control: false, acceso: false });
    expect(Object.keys(SECURITY_LABELS)).not.toContain("objetos");
  });

  it("labels acceso as restricted access", () => {
    expect(SECURITY_LABELS.acceso).toBe("Acceso restringido 24/7");
  });
});
