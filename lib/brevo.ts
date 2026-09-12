import "server-only";

// Minimal Brevo (formerly Sendinblue) transactional email client using fetch
// (no SDK dependency required). Configure via environment variables:
//   BREVO_API_KEY      - your Brevo API key (server-only, never public)
//   BREVO_SENDER_EMAIL - a verified/authenticated sender address in Brevo
//   BREVO_SENDER_NAME  - optional display name for the sender

type SendArgs = {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

export async function sendTransactionalEmail({ to, toName, subject, text, replyTo }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "not-configured" };

  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@figimi.com";
  const senderName = process.env.BREVO_SENDER_NAME || "Figimi Contact";

  const payload: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name: toName || to }],
    subject,
    textContent: text,
  };
  if (replyTo) payload.replyTo = { email: replyTo };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `brevo-${response.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "send-failed" };
  }
}
