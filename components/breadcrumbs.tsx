import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const jsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, ...(item.href ? { item: absoluteUrl(item.href) } : {}) })) };
  return <><nav className="breadcrumbs" aria-label="Breadcrumb">{items.map((item, i) => <span key={item.label}>{i > 0 && <b aria-hidden="true">/</b>}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /></>;
}
