import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getContentPage, getContentPageSlugs } from "@/lib/data";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getContentPageSlugs()).map((legal) => ({ legal }));
}

export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }): Promise<Metadata> {
  const { legal } = await params;
  const page = await getContentPage(legal);
  if (!page) return {};
  return {
    title: page.seo_title || page.title,
    description: page.description,
    alternates: { canonical: `/${legal}` },
    openGraph: { title: page.title, description: page.description, url: `/${legal}`, type: "website", images: page.og_image ? [{ url: page.og_image }] : undefined },
  };
}

export default async function ContentPage({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  const page = await getContentPage(legal);
  if (!page) notFound();
  return (
    <div className="shell narrow">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.title }]} />
      <article className="legal-page">
        <header>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </header>
        <div className="markdown"><ReactMarkdown>{page.body}</ReactMarkdown></div>
      </article>
    </div>
  );
}
