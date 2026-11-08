export const DEFAULT_EMAIL_TIMEOUT_MS = 10_000;

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  timeoutMs: number = DEFAULT_EMAIL_TIMEOUT_MS
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM;

    if (!apiKey || !fromAddress) {
      throw new Error("Missing EMAIL_PROVIDER_API_KEY or EMAIL_FROM_ADDRESS in production");
    }

    console.log(`📧 Sending email to ${to}: ${subject} via Resend`);
    // Security: Enforce request timeout via AbortSignal to prevent slowloris attacks and socket/memory starvation DoS
    // when communicating with external email delivery endpoints.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        text: body,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // Security: Sanitize error message to avoid leaking raw external provider response details or stack traces
      throw new Error(`Failed to send email via Resend: ${response.status}`);
    }
  } else {
    console.log(`📧 Email to ${to}: ${subject} — ${body}`);
  }
}
