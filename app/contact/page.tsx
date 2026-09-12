import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContactForm } from "@/components/contact-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Contact Us", description: "Contact Figimi Tools with support questions, bug reports, privacy requests, or product suggestions.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="shell narrow">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      <article className="legal-page">
        <header>
          <span className="eyebrow">We are listening</span>
          <h1>Contact us</h1>
          <p>Send a support question, report a broken conversion, request help with your privacy rights, or suggest a practical new tool.</p>
        </header>

        <ContactForm />

        <div className="contact-card">
          <span><Mail /></span>
          <div>
            <h2>Prefer email?</h2>
            <p>You can also write to us directly at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. Please do not attach sensitive source documents — describe the file format and error instead.</p>
          </div>
        </div>

        <section className="contact-notes">
          <h2>What to include</h2>
          <ul>
            <li>The tool or page you were using.</li>
            <li>Your browser and device type.</li>
            <li>The exact error message, without confidential file contents.</li>
          </ul>
          <p>We aim to review legitimate messages promptly. Response times may vary because the public tools are provided without a paid support plan.</p>
        </section>
      </article>
    </div>
  );
}
