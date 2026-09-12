import type { BlogPost, SiteSettings } from "@/types";

export const seedPost: BlogPost = {
  id: "00000000-0000-0000-0000-000000000001", title: "How to Improve Your Writing with a Word Counter", slug: "improve-writing-with-word-counter", meta_description: "Learn how word count, sentence length, reading time, and keyword density can make your writing clearer and more useful.", featured_image: null, featured_image_alt: "Writer reviewing article statistics", category: "Writing", tags: ["word count", "writing", "productivity"], author: "Figimi Editorial", status: "published", published_at: "2026-01-15T09:00:00.000Z", created_at: "2026-01-15T09:00:00.000Z", updated_at: "2026-01-15T09:00:00.000Z", seo_title: "How to Use a Word Counter to Improve Writing", og_image: null,
  body: `A word counter can do much more than confirm that an essay meets a limit. Used thoughtfully, the statistics reveal how a reader may experience your draft.

## Start with the purpose, not the number

Before cutting or adding words, decide what the page needs to achieve. A support answer should usually be direct. A tutorial can be longer when each section helps the reader complete a task. Word count is a constraint—not a quality score.

## Watch sentence and paragraph rhythm

Long sentences are not automatically difficult, but several in a row can make important instructions harder to scan. Mix short statements with more developed explanations. Paragraph totals also provide a quick signal: a long article with only two paragraphs will feel dense on a phone.

## Use reading time as a promise

An estimated reading time helps you evaluate the commitment you ask from visitors. If a simple answer takes eight minutes to reach, move the direct answer earlier and use clear headings for the detail that follows.

## Treat keyword density as a diagnostic

Frequent terms should appear naturally because they describe the subject. Do not repeat phrases simply to increase a percentage. Instead, use the density list to notice accidental repetition, missing vocabulary, and places where a precise synonym would improve the prose.

## Review the final draft aloud

Statistics point to possible problems; they cannot judge tone or meaning. Read the final version aloud, check names and claims, and make sure every paragraph earns its place. The best result is not a particular count. It is useful writing that respects the reader's time.`,
};

export const legalPages = {
  "privacy-policy": { title: "Privacy Policy", description: "How Figimi Tools handles text, uploaded files, analytics, advertising, and contact information.", body: `## Overview

We designed Figimi Tools to collect as little information as practical. Text entered into browser-based counters, capitalization, comparison, and color tools is processed locally and is not intentionally transmitted to our servers.

## File conversion and retention

Files submitted to a conversion tool are transferred over HTTPS and used only to perform the requested conversion. Processing occurs in an isolated temporary directory. Files are removed immediately after the response whenever possible and are automatically deleted no later than one hour after upload. We do not use uploaded documents for advertising, model training, or resale. Do not upload files you are not authorized to process.

## Website word counter

When you submit a public URL, our server requests that page to calculate readable text statistics. We block private network addresses. Submitted URLs may appear briefly in operational security logs but are not used to create a marketing profile.

## Analytics, advertising, and cookies

If enabled, Google Analytics, Google Tag Manager, and Google AdSense may set cookies or process limited device, usage, and approximate location information. Google and its partners may use cookies to serve or measure ads. You can manage cookies in your browser and use Google's advertising controls. The site remains usable when common advertising cookies are blocked.

## Supabase and service providers

We use Supabase for database, authentication, and media storage, and may use Cloudflare for security, content delivery, and performance. These providers process limited technical information under their own privacy terms.

## Data rights and contact

Depending on your location, you may request access, correction, or deletion of personal information we hold. Contact us through the Contact page. We may update this policy when the service changes. Last updated: July 22, 2026.` },
  "terms-of-service": { title: "Terms of Service", description: "Rules and conditions for using Figimi Tools and its free conversion services.", body: `## Acceptance and permitted use

By using Figimi Tools, you agree to these terms. You may use the service only for lawful purposes and only with content and files you own or are authorized to process. You must not probe, overload, automate abusive traffic against, or attempt to bypass the security limits of the service.

## No account or conversion guarantee

Public tools are provided without charge and may change or become temporarily unavailable. Conversions can lose formatting, formulas, fonts, metadata, or image quality. Always inspect the result before relying on it and keep your original file.

## Intellectual property

You retain rights to content you submit. You grant us only the limited permission needed to process the request and return the result. The site design, original editorial content, and software branding remain protected by applicable law.

## Disclaimer and limitation

The service is provided “as is” without warranties of accuracy, availability, or fitness for a particular purpose. To the extent permitted by law, we are not liable for indirect loss, lost data, or decisions made from tool output.

## Changes and contact

We may update these terms to reflect legal or product changes. Continued use after an update means you accept the revised terms. Questions can be sent through the Contact page. Last updated: July 22, 2026.` },
  about: { title: "About Us", description: "Figimi is an independent, privacy-first platform of free online tools for text, PDFs, documents, images, video, and color — built and maintained in the European Union by Aymen Lasfar.", body: `Figimi is a free, privacy-first collection of online tools that help you get everyday digital tasks done in seconds — counting words, converting PDFs and documents, compressing images and video, extracting text from pictures, and working with color. There is nothing to install and no account to create. You open a page, use the tool, and you are done.

## Who is behind Figimi

Figimi is an independent project founded, built, and maintained by **Aymen Lasfar**, based in Portugal (European Union). It is not a large corporation harvesting your data — it is a focused, carefully built product from a single maker who uses these tools every day and cares about doing them well. Being based in the EU also means Figimi is built around strong data-protection expectations from the start.

## Our mission

We believe useful software should feel simple, load fast, and respect your privacy. Too many "free tools" bury a small feature under pop-ups, forced sign-ups, and confusing steps. Figimi's mission is the opposite: give you a clear, honest tool that does exactly what it says, explains its limits, and works just as well on a phone as on a laptop.

## What you can do with Figimi

Figimi brings together tools that people usually hunt across a dozen different websites:

- **Text tools** — analyze and clean up writing with the [Word Counter](/tools/word-counter), [Character Counter](/tools/character-counter), [Web Page Word Counter](/tools/website-word-counter), [Auto Capitalize](/tools/auto-capitalize), and [Compare Text](/tools/compare-text).
- **PDF & document converters** — [PDF to Word](/tools/pdf-to-word), [Word to PDF](/tools/word-to-pdf), [PDF to JPG](/tools/pdf-to-jpg), [JPG to PDF](/tools/jpg-to-pdf), [PDF to Excel](/tools/pdf-to-excel), [PowerPoint to PDF](/tools/ppt-to-pdf), and more.
- **Image & video tools** — shrink files with the [Image Compressor](/tools/image-compressor) and [Video Compressor](/tools/video-compressor), convert formats like [HEIC to JPG](/tools/heic-to-jpg), and pull editable text out of pictures with our in-browser [Image to Text (OCR)](/tools/image-to-text).
- **Color & design tools** — explore harmonies with the [Color Wheel](/tools/color-wheel) and spark ideas with the [Random Color Generator](/tools/random-color-generator).
- **Guides** — practical, original how-to articles on the [Figimi blog](/blog).

## Built around your privacy

Privacy isn't an afterthought at Figimi — it shapes how the tools are built:

- **Many tools run entirely in your browser.** Text counters, case conversion, text comparison, color tools, image compression, and OCR process your content on your own device, so it never leaves your computer or phone.
- **Files are deleted quickly.** When a tool must process a file on our server (such as certain conversions and video compression), it is handled in isolated temporary storage and deleted automatically right after processing — and in all cases within **one hour**.
- **No accounts, no profiles, no data sales.** We don't require sign-up, we don't build advertising profiles from your files, and we never sell your data.

You can read the full details in our [Privacy Policy](/privacy-policy) and [Security & Compliance](/security-and-compliance) pages.

## Free, fast, and for everyone

Every tool on Figimi is free to use, with no hidden paywall on core features. We keep pages lightweight so they load quickly even on slower connections, and we design them to be usable with a keyboard and readable on any screen size. Whether you are a student finishing an assignment, a writer polishing a draft, an office worker converting a report, or a designer choosing a palette, the tools are meant to just work.

## How we build and maintain Figimi

Figimi is built on a modern, server-rendered web stack for speed and reliability. Beyond shipping features, we:

- Test pages for accessibility, responsive layout, and fast loading.
- Write **original** guides that genuinely help — never empty, auto-generated filler.
- Update tools and content as formats, browsers, and best practices evolve.

Because tools can occasionally lose formatting or precision (for example, complex PDF layouts), we always recommend reviewing an important result against your original file.

## Our commitment to you

- **Transparency** — each tool explains what it does and its limitations.
- **Honesty** — no dark patterns, forced installs, or misleading buttons.
- **Respect** — your time and your data are treated as they should be.

## Get in touch

Have an idea for a new tool, found a bug, or want to make a request about your data? We'd genuinely like to hear from you — practical feedback directly shapes what we build next. Reach us anytime through the [Contact page](/contact).` },
  "security-and-compliance": { title: "Security & Compliance", description: "How Figimi protects your data: encryption, automatic file deletion, trusted infrastructure, GDPR compliance, and responsible disclosure.", body: `At Figimi, protecting your data is as important as delivering fast, reliable tools. This page summarizes the security practices and compliance measures behind the service. Figimi is operated by Aymen Lasfar from Portugal (European Union).

## Encryption in transit

All traffic between your browser and Figimi is encrypted using industry-standard HTTPS/TLS. Files you submit to a server-side tool are transferred over the same encrypted connection.

## File handling and automatic deletion

- Many tools (text counters, case conversion, comparison, color tools, image compression, and OCR) run **entirely in your browser** — those files never reach our servers.
- When a tool must process your file on our server, it is written only to an **isolated, temporary working directory** for the short time needed to complete the task.
- Uploaded files and their generated outputs are **deleted automatically** immediately after processing, and in all cases within a maximum of **one (1) hour**.
- We do not back up, index, view, or reuse your files, and we never use them for advertising or model training.

## Infrastructure and sub-processors

We rely on a small number of reputable providers, each with its own strong security program:

- **Railway** — application hosting and file processing.
- **Supabase** — database, administrator authentication, and media storage for site content.
- **Cloudflare** — DNS, TLS, content delivery, and protection against attacks.
- **Google** (Analytics, Tag Manager, AdSense) — where enabled, for measurement and advertising.
- **Brevo** — delivery of contact-form and service emails.

Each provider processes only the limited data needed to perform its function, under its own security and privacy terms.

## Access control

Administrative access to the site is restricted to the operator and protected by strong authentication. Only authorized access can manage content and settings; there is no public user account system that stores personal profiles.

## Data protection and GDPR

Figimi is established in the European Union and processes personal data in line with the EU General Data Protection Regulation (GDPR). We practice data minimization, keep information only as long as necessary, and honor data-subject rights (access, correction, deletion, and objection). Our lead supervisory authority is the Portuguese data protection authority, the CNPD ([cnpd.pt](https://www.cnpd.pt)). For details on what we process and why, see our [Privacy Policy](/privacy-policy).

## Cookies and consent

Where required by law, non-essential analytics and advertising cookies are set only after you consent, and you can change your choice at any time using the "Manage cookie preferences" link in the footer.

## Responsible disclosure

If you believe you have found a security vulnerability in Figimi, we appreciate a responsible report. Please contact us through the [Contact page](/contact) with enough detail to reproduce the issue, and allow us reasonable time to investigate and remediate before any public disclosure. Do not access, modify, or delete data that is not your own while testing.

## Contact

For any security or compliance question, reach us via the [Contact page](/contact).` },
} as const;

export const seedSettings: SiteSettings = { analytics_id: "", adsense_client_id: "", google_tag_id: "", head_code: "", body_code: "", ads_txt: "" };
