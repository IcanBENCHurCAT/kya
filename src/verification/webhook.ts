import { CompactSign, importPKCS8 } from "jose";

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
