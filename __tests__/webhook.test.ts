import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebhookService, isValidCallbackUrl } from "../src/verification/webhook.js";
import { generateSigningKey } from "../src/utils/crypto.js";
import { compactVerify, importSPKI } from "jose";
import { EmailVerificationProvider } from "../src/verification/providers/email-provider.js";
import { InMemoryAttemptStore } from "../src/verification/in-memory-store.js";
import { InMemoryClaimStore } from "../src/verification/in-memory-claim-store.js";

describe("WebhookService", () => {
  let webhookService: WebhookService;
  let privateKey: string;
  let publicKey: string;
  let keyId = "test-key-id";
  
  beforeEach(async () => {
    const keys = await generateSigningKey();
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
    webhookService = new WebhookService(privateKey, keyId);

    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should construct and sign webhook payloads correctly, returning immediately", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

    const payload = {
      status: "success",
      walletAddress: "TEST_WALLET",
      identityHash: "hash123",
      method: "email",
      verifiedAt: 1234567890
    };

    // Should not throw or wait blockingly for the whole retry chain
    webhookService.dispatch("https://example.com/webhook", payload);

    // Give the async background process a moment to trigger fetch
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Key-Id"]).toBe(keyId);
    expect(init.redirect).toBe("error");

    // Verify the payload
    expect(JSON.parse(init.body)).toEqual(payload);

    // Reconstruct JWS and verify signature
    const signatureHex = init.headers["X-Signature"];
    const base64urlSignature = Buffer.from(signatureHex, "hex").toString("base64url");
    const base64urlMessage = Buffer.from(init.body).toString("base64url");
    const header = Buffer.from(JSON.stringify({ alg: "EdDSA", kid: keyId })).toString("base64url");
    const jws = `${header}.${base64urlMessage}.${base64urlSignature}`;

    const spkiKey = await importSPKI(publicKey, "EdDSA");
    const result = await compactVerify(jws, spkiKey);
    const decoded = new TextDecoder().decode(result.payload);
    expect(JSON.parse(decoded)).toEqual(payload);
  });

  it("should enforce redirect: 'error' on fetch to block HTTP 301/302 SSRF redirect attempts", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

    webhookService.dispatch("https://example.com/webhook-redirect-test", { redirectTest: true }, 0);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("https://example.com/webhook-redirect-test");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toEqual({ redirectTest: true });
  });

  it("should retry on failure up to maxRetries", async () => {
    // Fail first two times, succeed on the third
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const payload = { test: true };
    const maxRetries = 2; // initial attempt + 2 retries = 3 total attempts
    
    webhookService.dispatch("https://example.com/fail-webhook", payload, maxRetries);

    // Wait enough time for backoffs: 1s, 2s
    await new Promise((resolve) => setTimeout(resolve, 3500));

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("should stop after maxRetries and log error on final failure", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    const maxRetries = 1; 
    webhookService.dispatch("https://example.com/fail-webhook", { test: true }, maxRetries);

    // Wait for backoff: 1s
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Final webhook delivery failure"),
      expect.any(Error)
    );
  });

  it("should validate callback URLs and block internal/private SSRF targets", () => {
    expect(isValidCallbackUrl("https://example.com/webhook")).toBe(true);
    expect(isValidCallbackUrl("http://api.service.org/callback")).toBe(true);

    // Forbidden SSRF targets
    expect(isValidCallbackUrl("http://127.0.0.1:3000/internal")).toBe(false);
    expect(isValidCallbackUrl("http://127.0.0.2:3000/internal")).toBe(false);
    expect(isValidCallbackUrl("http://localhost:8080")).toBe(false);
    expect(isValidCallbackUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isValidCallbackUrl("http://10.0.0.1/admin")).toBe(false);
    expect(isValidCallbackUrl("http://192.168.1.1/router")).toBe(false);
    expect(isValidCallbackUrl("http://[::1]/status")).toBe(false);
    expect(isValidCallbackUrl("http://[::]/status")).toBe(false);
    expect(isValidCallbackUrl("http://[::ffff:127.0.0.1]/status")).toBe(false);
    expect(isValidCallbackUrl("http://[::ffff:169.254.169.254]/status")).toBe(false);
    expect(isValidCallbackUrl("http://[::ffff:10.0.0.1]/status")).toBe(false);
    expect(isValidCallbackUrl("http://internal-service.local")).toBe(false);

    // Non-canonical IPv4 SSRF bypass targets (octal, hex, DWORD integer)
    expect(isValidCallbackUrl("http://0177.0.0.1/status")).toBe(false);
    expect(isValidCallbackUrl("http://0x7f.0.0.1/status")).toBe(false);
    expect(isValidCallbackUrl("http://2130706433/status")).toBe(false);
    expect(isValidCallbackUrl("http://0x7f000001/status")).toBe(false);
    expect(isValidCallbackUrl("http://012.0.0.1/status")).toBe(false);
    expect(isValidCallbackUrl("http://0251.0372.0169.0254/status")).toBe(false);

    // Wildcard DNS resolution services and embedded private/loopback IP subdomains
    expect(isValidCallbackUrl("http://test.127.0.0.1.nip.io/webhook")).toBe(false);
    expect(isValidCallbackUrl("http://app.169.254.169.254.nip.io/metadata")).toBe(false);
    expect(isValidCallbackUrl("http://foo.10.0.0.1.sslip.io/callback")).toBe(false);
    expect(isValidCallbackUrl("http://app.localtest.me/status")).toBe(false);
    expect(isValidCallbackUrl("http://sub.127.0.0.1.customdomain.com/webhook")).toBe(false);
    expect(isValidCallbackUrl("http://api.192.168.1.1.internal.org/webhook")).toBe(false);

    expect(isValidCallbackUrl("ftp://example.com/upload")).toBe(false);
    expect(isValidCallbackUrl("not-a-url")).toBe(false);
    expect(isValidCallbackUrl("")).toBe(false);
  });

  it("should reject webhook dispatch to internal SSRF targets without invoking fetch", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    webhookService.dispatch("http://127.0.0.1/internal-status", { data: 123 });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Final webhook delivery failure"),
      expect.any(Error)
    );
  });

  it("should reject invalid or forbidden SSRF callbackUrl during EmailVerificationProvider.initiateVerification", async () => {
    const emailProvider = new EmailVerificationProvider({
      attemptStore: new InMemoryAttemptStore(),
      claimStore: new InMemoryClaimStore() as any,
      privateKey,
      keyId,
    });

    const validWallet = "W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE";

    await expect(
      emailProvider.initiateVerification({
        identifier: "user@example.com",
        walletAddress: validWallet,
        callbackUrl: "http://127.0.0.1:3000/internal",
      })
    ).rejects.toMatchObject({
      code: "INVALID_CALLBACK_URL",
      status: 400,
    });

    await expect(
      emailProvider.initiateVerification({
        identifier: "user@example.com",
        walletAddress: validWallet,
        callbackUrl: "http://169.254.169.254/latest/meta-data/",
      })
    ).rejects.toMatchObject({
      code: "INVALID_CALLBACK_URL",
      status: 400,
    });
  });
});
