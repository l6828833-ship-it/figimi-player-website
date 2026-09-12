import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { toolCategories, tools } from "@/lib/tools";
import { HeaderNav } from "./header-nav";

const groups = toolCategories.map((category) => ({ category, items: tools.filter((tool) => tool.category === category).map((tool) => ({ slug: tool.slug, name: tool.name })) }));

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label={`${siteConfig.name} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.svg" alt="" width={36} height={36} aria-hidden="true" />
          {siteConfig.name}
        </Link>
        <HeaderNav groups={groups} />
      </div>
    </header>
  );
}
