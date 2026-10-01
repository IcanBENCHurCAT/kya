import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("App environment variables guard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should throw in production if both KYA_TREASURY_ADDRESS and ESCROW_ADDRESS are unset", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.KYA_TREASURY_ADDRESS;
    delete process.env.ESCROW_ADDRESS;

    await expect(import("../src/app.js")).rejects.toThrow(
      /FATAL: KYA_TREASURY_ADDRESS and ESCROW_ADDRESS/
    );
  });

  it("should warn but not throw in development/test if both are unset", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.KYA_TREASURY_ADDRESS;
    delete process.env.ESCROW_ADDRESS;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(import("../src/app.js")).resolves.toBeTruthy();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("WARNING: KYA_TREASURY_ADDRESS and ESCROW_ADDRESS are both unset")
    );
  });

  it("should not throw or warn in production if KYA_TREASURY_ADDRESS is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.KYA_TREASURY_ADDRESS = "SOME_TREASURY_ADDRESS";
    delete process.env.ESCROW_ADDRESS;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(import("../src/app.js")).resolves.toBeTruthy();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not throw or warn in production if ESCROW_ADDRESS is set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.KYA_TREASURY_ADDRESS;
    process.env.ESCROW_ADDRESS = "SOME_ESCROW_ADDRESS";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(import("../src/app.js")).resolves.toBeTruthy();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
