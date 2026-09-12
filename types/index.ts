export type ToolCategory = "Text tools" | "File converters" | "Design tools" | "Unit converters";
export type ToolKind = "word-counter" | "character-counter" | "website-counter" | "capitalize" | "compare" | "converter" | "color-wheel" | "random-color" | "image-to-text" | "image-compressor" | "video-compressor" | "weight-converter";

export interface Faq { question: string; answer: string }
export interface ToolDefinition {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: ToolCategory;
  kind: ToolKind;
  accept?: string;
  output?: string;
  keywords: string[];
  faq: Faq[];
}

export interface ToolPageRecord {
  slug: string;
  title: string;
  description: string;
  intro: string;
  how_to: string[];
  faq: Faq[];
  body: string;
  seo_title: string;
  seo_description: string;
  og_image: string | null;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  featured_image: string | null;
  featured_image_alt: string;
  category: string;
  tags: string[];
  author: string;
  body: string;
  status: "draft" | "scheduled" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  seo_title?: string | null;
  og_image?: string | null;
}

export interface SiteSettings {
  analytics_id: string;
  adsense_client_id: string;
  google_tag_id: string;
  head_code: string;
  body_code: string;
  /** Extra ads.txt / sellers lines for non-AdSense networks, one per line. */
  ads_txt: string;
}

/** A configurable ad area on the site. */
export interface AdPlacement {
  key: string;
  label: string;
  hint: string;
}

/**
 * Stored configuration for one ad area. `code` accepts raw markup from any ad
 * network; `adsense_slot` is only a convenience fallback for Google AdSense.
 */
export interface AdUnit {
  placement: string;
  name: string;
  code: string;
  adsense_slot: string;
  enabled: boolean;
}


export interface ContentPageRecord {
  slug: string;
  title: string;
  description: string;
  body: string;
  seo_title?: string | null;
  og_image?: string | null;
}
