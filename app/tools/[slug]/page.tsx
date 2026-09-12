import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdSlot } from "@/components/ad-slot";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ToolWorkspace } from "@/components/tool-workspace";
import { getToolPage } from "@/lib/data";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { toolBySlug, tools } from "@/lib/tools";

export const revalidate = 300;
export function generateStaticParams() { return tools.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const tool = toolBySlug(slug), page = await getToolPage(slug); if (!tool || !page) return {}; const title = page.seo_title; return { title, description: page.seo_description, keywords: tool.keywords, alternates: { canonical: `/tools/${tool.slug}` }, openGraph: { title, description: page.seo_description, url: `/tools/${tool.slug}`, type: "website", images: page.og_image ? [page.og_image] : undefined }, twitter: { card: "summary_large_image", title, description: page.seo_description, images: page.og_image ? [page.og_image] : undefined } }; }

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, tool = toolBySlug(slug), page = await getToolPage(slug); if (!tool || !page) notFound();
  const schema = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: page.title, applicationCategory: "UtilitiesApplication", operatingSystem: "Any", url: absoluteUrl(`/tools/${slug}`), description: page.intro, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url } };
  return <><div className="shell"><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools", href: "/#tools" }, { label: page.title }]} /><header className="tool-hero"><span className="eyebrow">{tool.category}</span><h1>{page.title}</h1><p>{page.description}</p></header><AdSlot placement="tool-header" /><section className="workspace" aria-label={page.title}><ToolWorkspace tool={tool} /></section><div className="content-with-ad"><article className="tool-content"><h2>What is {page.title}?</h2><p>{page.intro}</p><h2>How to use this tool</h2><ol>{page.how_to.map((step) => <li key={step}>{step}</li>)}</ol>{page.body?.trim() ? <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{page.body}</ReactMarkdown></div> : <><h2>Why use {page.title}?</h2><p>This tool is designed for easy use on your phone, tablet, or computer. There is no need to register an account to use it. Always review your results, especially when the source document uses structured or complex formatting.</p></>}<section className="faq"><h2>Frequently asked questions</h2>{page.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section></article><AdSlot placement="tool-sidebar" className="sidebar-ad" /></div></div><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} /></>;
}
