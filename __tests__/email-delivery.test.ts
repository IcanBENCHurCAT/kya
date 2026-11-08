import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, DEFAULT_EMAIL_TIMEOUT_MS } from "../src/utils/email.js";

describe("Email Delivery via Resend", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchMock: any;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should use console.log in non-production environments", async () => {
    process.env.NODE_ENV = "development";

    await sendEmail("test@example.com", "Test Subject", "Test Body");

    expect(console.log).toHaveBeenCalledWith("📧 Email to test@example.com: Test Subject — Test Body");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should throw error in production if EMAIL_PROVIDER_API_KEY is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.EMAIL_PROVIDER_API_KEY;
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";

    await expect(sendEmail("test@example.com", "Test Subject", "Test Body"))
      .rejects.toThrow("Missing EMAIL_PROVIDER_API_KEY or EMAIL_FROM_ADDRESS in production");
  });

  it("should throw error in production if EMAIL_FROM_ADDRESS is missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER_API_KEY = "test_key";
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM;

    await expect(sendEmail("test@example.com", "Test Subject", "Test Body"))
      .rejects.toThrow("Missing EMAIL_PROVIDER_API_KEY or EMAIL_FROM_ADDRESS in production");
  });

  it("should fall back to EMAIL_FROM if EMAIL_FROM_ADDRESS is missing in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER_API_KEY = "test_key";
    delete process.env.EMAIL_FROM_ADDRESS;
    process.env.EMAIL_FROM = "fallback@example.com";

    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    await sendEmail("test@example.com", "Test Subject", "Test Body");

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      body: JSON.stringify({
        from: "fallback@example.com",
        to: "test@example.com",
        subject: "Test Subject",
        text: "Test Body"
      })
    }));
  });

  it("should send email using fetch in production when env vars are set", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER_API_KEY = "test_key";
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";

    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    await sendEmail("test@example.com", "Test Subject", "Test Body");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer test_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@example.com",
        to: "test@example.com",
        subject: "Test Subject",
        text: "Test Body"
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it("should configure custom timeoutMs and pass AbortSignal to fetch in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER_API_KEY = "test_key";
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";

    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    await sendEmail("test@example.com", "Test Subject", "Test Body", 5000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.resend.com/emails");
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("should abort and reject when external email provider request times out", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER_API_KEY = "test_key";
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";

    // Simulate fetch hanging and triggering AbortSignal timeout
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            const abortErr = new Error("The operation was aborted");
            abortErr.name = "TimeoutError";
            reject(abortErr);
          });
        }
      });
    });

    await expect(sendEmail("test@example.com", "Test Subject", "Test Body", 10))
      .rejects.toThrow();
  });

  it("should throw error if fetch response is not ok", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER_API_KEY = "test_key";
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";

    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Sensitive internal detail leak",
    });

    await expect(sendEmail("test@example.com", "Test Subject", "Test Body"))
      .rejects.toThrow("Failed to send email via Resend: 400");
  });
});
