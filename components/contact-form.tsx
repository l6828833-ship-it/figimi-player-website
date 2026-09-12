"use client";

import { useActionState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { sendContactMessage, type ContactState } from "@/app/contact/actions";

const initial: ContactState = {};

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, initial);

  if (state.ok) {
    return (
      <div className="notice success" role="status">
        Thanks — your message has been sent. We&apos;ll reply by email as soon as we can.
      </div>
    );
  }

  return (
    <form action={action} className="contact-form" noValidate>
      {state.error && <div className="notice error" role="alert">{state.error}</div>}

      <label>
        Your name
        <input name="name" autoComplete="name" required maxLength={100} />
        {state.fieldErrors?.name && <span className="field-error">{state.fieldErrors.name}</span>}
      </label>

      <label>
        Your email
        <input name="email" type="email" autoComplete="email" required maxLength={200} />
        {state.fieldErrors?.email && <span className="field-error">{state.fieldErrors.email}</span>}
      </label>

      <label>
        Subject
        <input name="subject" maxLength={150} placeholder="How can we help?" />
        {state.fieldErrors?.subject && <span className="field-error">{state.fieldErrors.subject}</span>}
      </label>

      <label>
        Message
        <textarea name="message" rows={6} required maxLength={5000} />
        {state.fieldErrors?.message && <span className="field-error">{state.fieldErrors.message}</span>}
      </label>

      {/* Honeypot field: hidden from real users; bots that fill it are ignored. */}
      <div aria-hidden="true" className="hp-field">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button className="button primary" disabled={pending}>
        {pending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
