import { CompactSign, importPKCS8 } from "jose";

/**
 * Security: Validates callback URLs to prevent Server-Side Request Forgery (SSRF)
 * and unhandled URL parsing exceptions. Blocks loopback, private IP ranges,
 * cloud metadata endpoints, and internal domain suffixes.
 */
export function isValidCallbackUrl(urlStr: unknown): boolean {
  if (typeof urlStr !== "string" || urlStr.length === 0 || urlStr.length > 255) {
    return false;
  }
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const rawHost = parsed.hostname.toLowerCase();
    let clean = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
    if (clean.startsWith("::ffff:")) {
      clean = clean.slice(7);
    } else if (clean.startsWith("0:0:0:0:0:ffff:")) {
      clean = clean.slice(15);
    }

    let target = clean;
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
      const parts = clean.split(":");
      if (parts.length === 2) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);
        if (!isNaN(high) && !isNaN(low)) {
          target = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        }
      }
    }

    if (
      target === "localhost" ||
      target.endsWith(".local") ||
      target.endsWith(".internal") ||
      /^0\.|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\.|^169\.254\./.test(target) ||
      target === "::" ||
      target === "::1" ||
      target === "0:0:0:0:0:0:0:0" ||
      target === "0:0:0:0:0:0:0:1" ||
      /^fe[89ab]/i.test(target) ||
      /^f[cd]/i.test(target)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export class WebhookService {
  private pkcs8KeyPromise: Promise<any>;

  constructor(private privateKey: string, private keyId: string) {
    this.pkcs8KeyPromise = importPKCS8(this.privateKey, "EdDSA");
  }

  /**
   * Dispatches a webhook asynchronously with retry and backoff.
   */
  dispatch(
    url: string,
    payload: Record<string, any>,
    maxRetries = 3
  ): void {
    // Detached dispatch so the caller doesn't wait
    this.sendWithRetry(url, payload, maxRetries, 0).catch((err) => {
      console.error(`[WebhookService] Final webhook delivery failure to ${url}:`, err);
    });
  }

  private async sendWithRetry(
    url: string,
    payload: Record<string, any>,
    maxRetries: number,
    attempt: number
  ): Promise<void> {
    if (!isValidCallbackUrl(url)) {
      throw new Error(`Invalid or forbidden webhook callback URL: ${url}`);
    }
    try {
      const payloadString = JSON.stringify(payload);
      
      const privateKey = await this.pkcs8KeyPromise;
      const signer = new CompactSign(new TextEncoder().encode(payloadString));
      signer.setProtectedHeader({ alg: "EdDSA", kid: this.keyId });
      const jws = await signer.sign(privateKey);
      
      // Extract signature (third part of JWS) as hex
      const signatureHex = Buffer.from(jws.split(".")[2], "base64url").toString("hex");

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signatureHex,
          "X-Key-Id": this.keyId,
        },
        body: payloadString,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
    } catch (error) {
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`[WebhookService] Delivery to ${url} failed, retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.sendWithRetry(url, payload, maxRetries, attempt + 1);
      } else {
        throw error;
      }
    }
  }
}
