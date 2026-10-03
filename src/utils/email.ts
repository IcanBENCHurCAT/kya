export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM;

    if (!apiKey || !fromAddress) {
      throw new Error("Missing EMAIL_PROVIDER_API_KEY or EMAIL_FROM_ADDRESS in production");
    }

    console.log(`📧 Sending email to ${to}: ${subject} via Resend`);
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
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to send email via Resend: ${response.status} ${errorData}`);
    }
  } else {
    console.log(`📧 Email to ${to}: ${subject} — ${body}`);
  }
}
