import { CompactSign, importPKCS8 } from "jose";

/**
 * Security: Normalizes non-canonical IPv4 representations (octal, hex, integer, 1/2/3-part formats)
 * into standard 4-octet dotted-decimal notation (`A.B.C.D`) to prevent SSRF bypasses.
 */
function normalizeIPv4Host(host: string): string | null {
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  const numbers: number[] = [];
  for (const p of parts) {
    if (!p) return null;
    let num: number;
    if (/^0x[0-9a-f]+$/i.test(p)) {
      num = parseInt(p, 16);
    } else if (/^0[0-7]+$/.test(p)) {
      num = parseInt(p, 8);
    } else if (/^\d+$/.test(p)) {
      num = parseInt(p, 10);
    } else {
      return null;
    }
    if (isNaN(num) || num < 0 || num > 0xffffffff) return null;
    numbers.push(num);
  }

  let ipNum: number;
  if (numbers.length === 1) {
    ipNum = numbers[0];
  } else if (numbers.length === 2) {
    if (numbers[0] > 0xff || numbers[1] > 0xffffff) return null;
    ipNum = (numbers[0] << 24) + numbers[1];
  } else if (numbers.length === 3) {
    if (numbers[0] > 0xff || numbers[1] > 0xff || numbers[2] > 0xffff) return null;
    ipNum = (numbers[0] << 24) + (numbers[1] << 16) + numbers[2];
  } else {
    if (numbers[0] > 0xff || numbers[1] > 0xff || numbers[2] > 0xff || numbers[3] > 0xff) return null;
    ipNum = (numbers[0] << 24) + (numbers[1] << 16) + (numbers[2] << 8) + numbers[3];
  }
  ipNum = ipNum >>> 0;
  return `${(ipNum >>> 24) & 0xff}.${(ipNum >>> 16) & 0xff}.${(ipNum >>> 8) & 0xff}.${ipNum & 0xff}`;
}

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
    const normalizedIPv4 = normalizeIPv4Host(clean);
    if (normalizedIPv4) {
      target = normalizedIPv4;
    } else {
      // Security: Unwrap IPv4-mapped and IPv4-compatible IPv6 addresses (e.g. `[::7f00:1]` or `[::ffff:7f00:1]`)
      const ipv6Parts = (clean.startsWith("::") ? clean.slice(2) : clean.startsWith("0:0:0:0:0:0:") ? clean.slice(12) : clean).split(":");
      if (ipv6Parts.length === 2 && /^[0-9a-f]{1,4}$/i.test(ipv6Parts[0]) && /^[0-9a-f]{1,4}$/i.test(ipv6Parts[1])) {
        const high = parseInt(ipv6Parts[0], 16);
        const low = parseInt(ipv6Parts[1], 16);
        if (!isNaN(high) && !isNaN(low)) {
          target = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        }
      }
    }

    if (
      target === "localhost" ||
      target.endsWith(".local") ||
      target.endsWith(".internal") ||
      target.endsWith(".nip.io") ||
      target.endsWith(".sslip.io") ||
      target.endsWith(".xip.io") ||
      target.endsWith(".lvh.me") ||
      target.endsWith(".localtest.me") ||
      target.endsWith(".traefik.me") ||
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

    // Security: Extract and validate embedded IPv4 sequences anywhere in domain labels
    // to block wildcard DNS or custom subdomains targeting private/loopback IP ranges
    const ipMatches = target.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
    if (ipMatches) {
      for (const candidate of ipMatches) {
        const norm = normalizeIPv4Host(candidate);
        if (
          norm &&
          /^0\.|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\.|^169\.254\./.test(norm)
        ) {
          return false;
        }
      }
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

      // Security: Disable automatic HTTP redirect following (`redirect: "error"`)
      // to prevent SSRF bypasses via external endpoints redirecting (301/302) to internal/loopback targets.
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signatureHex,
          "X-Key-Id": this.keyId,
        },
        body: payloadString,
        redirect: "error",
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
