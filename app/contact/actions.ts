"use server";

import { z } from "zod";
import { isEmailConfigured, sendTransactionalEmail } from "@/lib/brevo";
import { siteConfig } from "@/lib/site";

export type ContactState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100, "Name is too long."),
  email: z.string().trim().email("Please enter a valid email address.").max(200),
  subject: z.string().trim().max(150, "Subject is too long."),
  message: z.string().trim().min(10, "Please enter a message (at least 10 characters).").max(5000, "Message is too long."),
});

const str = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function sendContactMessage(_prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: a hidden field real users never fill. If it has content, silently
  // accept (so bots think they succeeded) without sending anything.
  if (str(form, "company").trim()) return { ok: true };

  const parsed = schema.safeParse({
    name: str(form, "name"),
    email: str(form, "email"),
    subject: str(form, "subject"),
    message: str(form, "message"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  if (!isEmailConfigured()) {
    return { error: `Our contact form isn't available right now. Please email us directly at ${siteConfig.email}.` };
  }

  const { name, email, subject, message } = parsed.data;
  const finalSubject = `[${siteConfig.name} Contact] ${subject || "New message"} — from ${name}`;
  const text = `New message via ${siteConfig.name} contact form\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject || "(none)"}\n\nMessage:\n${message}\n`;

  const result = await sendTransactionalEmail({ to: siteConfig.email, subject: finalSubject, text, replyTo: email });
  if (!result.ok) {
    return { error: `Sorry, we couldn't send your message right now. Please email us directly at ${siteConfig.email}.` };
  }
  return { ok: true };
}
