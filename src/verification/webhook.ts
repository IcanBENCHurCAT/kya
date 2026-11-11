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
    // Security: Strip trailing dots from FQDN representations (e.g. "localhost.", "metadata.google.internal.")
    // to prevent SSRF bypasses against exact hostname and suffix checks.
    const unbracketed = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
    const clean = unbracketed.replace(/\.+$/, "");

    let target = clean;
    const normalizedIPv4 = normalizeIPv4Host(clean);
    if (normalizedIPv4) {
      target = normalizedIPv4;
    } else {
      // Security: Unwrap IPv4-mapped, IPv4-compatible, NAT64 (64:ff9b::/96), and SIIT (::ffff:0:0/96) IPv6 addresses
      let candidate = clean;
      if (candidate.startsWith("::ffff:")) {
        candidate = candidate.slice(7);
      } else if (candidate.startsWith("0:0:0:0:0:ffff:")) {
        candidate = candidate.slice(15);
      }

      const normalizedCandidateIPv4 = normalizeIPv4Host(candidate);
      if (normalizedCandidateIPv4) {
        target = normalizedCandidateIPv4;
      } else {
        const isEmbeddedIPv6 =
          clean.startsWith("::") ||
          clean.startsWith("0:0:0:0:0:0:") ||
          clean.startsWith("64:ff9b::") ||
          clean.startsWith("64:ff9b:1::") ||
          clean.startsWith("::ffff:0:");
        const ipv6Parts = clean.split(":");
        if (isEmbeddedIPv6 && ipv6Parts.length >= 3) {
          const p1 = ipv6Parts[ipv6Parts.length - 2];
          const p2 = ipv6Parts[ipv6Parts.length - 1];
          if (/^[0-9a-f]{1,4}$/i.test(p1) && /^[0-9a-f]{1,4}$/i.test(p2)) {
            const high = parseInt(p1, 16);
            const low = parseInt(p2, 16);
            if (!isNaN(high) && !isNaN(low)) {
              target = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
            }
          }
        }
      }
    }

    // Security: Block private, loopback, link-local, carrier-grade NAT (100.64.0.0/10),
    // cloud metadata (169.254.169.254, 100.100.100.200), benchmarking (198.18.0.0/15),
    // multicast (224.0.0.0/4), and reserved/broadcast (240.0.0.0/4) ranges to prevent SSRF bypasses.
    const isForbiddenIPv4 =
      /^0\.|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\.|^169\.254\.|^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.|^100\.100\.100\.200$|^198\.(1[89])\.|^192\.0\.2\.|^198\.51\.100\.|^203\.0\.113\.|^(22[4-9]|23[0-9]|24[0-9]|25[0-5])\./;

    // Security: Block forbidden and reserved IPv6 ranges:
    // - unspecified (::), loopback (::1)
    // - Link-local (fe80::/10 -> fe8, fe9, fea, feb)
    // - Unique Local / ULA (fc00::/7 -> fc, fd)
    // - Site-local (deprecated RFC 3879 fec0::/10 -> fec, fed, fee, fef)
    // - Multicast (ff00::/8 -> ff)
    // - Documentation (2001:db8::/32)
    // - Discard-only prefix (RFC 6666 100::/64)
    // - Benchmarking (RFC 5180 2001:2::/48)
    // - ORCHIDv2 (RFC 7343 2001:20::/28)
    const isForbiddenIPv6 =
      target === "::" ||
      target === "::1" ||
      target === "0:0:0:0:0:0:0:0" ||
      target === "0:0:0:0:0:0:0:1" ||
      /^fe[89ab]/i.test(target) ||
      /^fe[c-f]/i.test(target) ||
      /^f[cd]/i.test(target) ||
      /^ff/i.test(target) ||
      /^2001:db8/i.test(target) ||
      /^100::/i.test(target) ||
      /^2001:2::/i.test(target) ||
      /^2001:20::/i.test(target);

    if (
      target === "localhost" ||
      target.endsWith(".localhost") ||
      target.endsWith(".local") ||
      target.endsWith(".localdomain") ||
      target.endsWith(".internal") ||
      target.endsWith(".nip.io") ||
      target.endsWith(".sslip.io") ||
      target.endsWith(".xip.io") ||
      target.endsWith(".lvh.me") ||
      target.endsWith(".localtest.me") ||
      target.endsWith(".traefik.me") ||
      isForbiddenIPv4.test(target) ||
      isForbiddenIPv6
    ) {
      return false;
    }

    // Security: Extract and validate embedded IPv4 sequences anywhere in domain labels
    // to block wildcard DNS or custom subdomains targeting private/loopback IP ranges
    const ipMatches = target.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
    if (ipMatches) {
      for (const candidate of ipMatches) {
        const norm = normalizeIPv4Host(candidate);
        if (norm && isForbiddenIPv4.test(norm)) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 10_000;

export class WebhookService {
  private pkcs8KeyPromise: Promise<any>;

  constructor(
    private privateKey: string,
    private keyId: string,
    private timeoutMs: number = DEFAULT_WEBHOOK_TIMEOUT_MS
  ) {
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

      // Security:
      // 1. Disable automatic HTTP redirect following (`redirect: "error"`)
      //    to prevent SSRF bypasses via external endpoints redirecting (301/302) to internal/loopback targets.
      // 2. Enforce request timeout via AbortSignal to prevent slowloris attacks and socket/memory starvation DoS.
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signatureHex,
          "X-Key-Id": this.keyId,
        },
        body: payloadString,
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
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
