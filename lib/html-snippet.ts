/**
 * Minimal, dependency-free parser for administrator-provided HTML snippets
 * (ad network tags, verification meta tags, analytics loaders, pixels…).
 *
 * Why this exists: snippets used to be injected from the browser after
 * hydration, which means verification `<meta>` tags and ad loader scripts were
 * absent from the HTML that crawlers and ad-network verifiers actually read.
 * Parsing the snippet on the server lets us render the real elements into the
 * document, so `view-source` and every verifier sees them.
 *
 * Anything this parser is not confident about is returned as `leftover` markup
 * and handed to the client-side injector, so no snippet is ever silently lost.
 */

export interface SnippetElement {
  tag: string;
  attrs: Record<string, string>;
  /** Raw inner HTML (empty for void elements). */
  inner: string;
}

export interface ParsedSnippet {
  nodes: SnippetElement[];
  /** Markup that must be injected client-side instead of server-rendered. */
  leftover: string;
}

/** Elements that never have children. */
export const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** Elements whose content is text, not markup, so nesting rules do not apply. */
const rawTextTags = new Set(["script", "style", "noscript", "textarea", "title"]);

/**
 * Tags that must never be injected: they either duplicate document structure or
 * fight with the framework's own metadata handling (a pasted <title> would give
 * the page two titles).
 */
const ignoredTags = new Set(["html", "head", "body", "title", "base"]);

/** Tags we are willing to render inside <head>. */
const headSafeTags = new Set(["meta", "link", "script", "style", "noscript"]);

/** Tags we are willing to render inside <body> (ad containers, pixels, loaders). */
const bodySafeTags = new Set(["script", "style", "noscript", "div", "span", "section", "aside", "p", "ul", "li", "a", "ins", "img", "iframe", "picture", "source", "video", "audio", "canvas", "table", "tbody", "tr", "td", "center", "font", "template", "link", "meta"]);

/** HTML attribute name -> React prop name. */
const propNames: Record<string, string> = {
  class: "className", for: "htmlFor", charset: "charSet", crossorigin: "crossOrigin", referrerpolicy: "referrerPolicy",
  "http-equiv": "httpEquiv", "accept-charset": "acceptCharset", srcset: "srcSet", srcdoc: "srcDoc", allowfullscreen: "allowFullScreen",
  allowtransparency: "allowTransparency", frameborder: "frameBorder", marginwidth: "marginWidth", marginheight: "marginHeight",
  nomodule: "noModule", tabindex: "tabIndex", usemap: "useMap", maxlength: "maxLength", minlength: "minLength", readonly: "readOnly",
  autoplay: "autoPlay", playsinline: "playsInline", autocomplete: "autoComplete", autofocus: "autoFocus", colspan: "colSpan",
  rowspan: "rowSpan", cellpadding: "cellPadding", cellspacing: "cellSpacing", contenteditable: "contentEditable",
  spellcheck: "spellCheck", enctype: "encType", novalidate: "noValidate", datetime: "dateTime", ismap: "isMap",
  bgcolor: "bgColor", valign: "vAlign", fetchpriority: "fetchPriority",
};

/** Attributes React expects as booleans rather than strings. */
const booleanProps = new Set(["async", "defer", "noModule", "allowFullScreen", "hidden", "disabled", "readOnly", "required", "checked", "multiple", "autoFocus", "autoPlay", "controls", "loop", "muted", "playsInline", "noValidate", "isMap", "reversed", "selected", "itemScope", "default", "open"]);

const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const openTagPattern = /^<([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  attrPattern.lastIndex = 0;
  while ((match = attrPattern.exec(raw))) {
    const name = match[1];
    if (!name || name === "/") continue;
    attrs[name.toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

/** Locates the index of the closing tag for `tag`, honouring nesting. */
function findClose(html: string, tag: string, from: number): { inner: string; end: number } | null {
  const lower = html.toLowerCase();
  const close = `</${tag}`;
  if (rawTextTags.has(tag)) {
    const at = lower.indexOf(close, from);
    if (at === -1) return null;
    const gt = html.indexOf(">", at);
    return gt === -1 ? null : { inner: html.slice(from, at), end: gt + 1 };
  }
  // `<div` must not match `<divider`, so the character after the name is checked.
  const isBoundary = (at: number) => !/[a-z0-9:-]/.test(lower[at + tag.length + 1] || "");
  let depth = 1, cursor = from;
  while (cursor < html.length) {
    let nextOpen = lower.indexOf(`<${tag}`, cursor);
    while (nextOpen !== -1 && !isBoundary(nextOpen)) nextOpen = lower.indexOf(`<${tag}`, nextOpen + 1);
    const nextClose = lower.indexOf(close, cursor);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) { depth += 1; cursor = nextOpen + tag.length + 1; continue; }
    depth -= 1;
    const gt = html.indexOf(">", nextClose);
    if (gt === -1) return null;
    if (depth === 0) return { inner: html.slice(from, nextClose), end: gt + 1 };
    cursor = gt + 1;
  }
  return null;
}

/** True when the element uses inline event handlers, which only work when injected as real HTML. */
function hasInlineHandler(attrs: Record<string, string>) { return Object.keys(attrs).some((name) => name.startsWith("on")); }

/**
 * Splits a snippet into elements we can safely server-render for the given
 * target, plus leftover markup for the client-side injector.
 */
export function parseSnippet(code: string, target: "head" | "body"): ParsedSnippet {
  const html = (code || "").trim();
  const result: ParsedSnippet = { nodes: [], leftover: "" };
  if (!html) return result;
  // A snippet with no tags at all is bare JavaScript: run it as an inline script.
  if (!html.includes("<")) { result.nodes.push({ tag: "script", attrs: {}, inner: html }); return result; }
  const allowed = target === "head" ? headSafeTags : bodySafeTags;
  const leftover: string[] = [];
  let i = 0;

  while (i < html.length) {
    const next = html.indexOf("<", i);
    if (next === -1) break;
    if (next > i) i = next;

    if (html.startsWith("<!--", i)) { const end = html.indexOf("-->", i); i = end === -1 ? html.length : end + 3; continue; }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) { const end = html.indexOf(">", i); i = end === -1 ? html.length : end + 1; continue; }

    const open = openTagPattern.exec(html.slice(i));
    if (!open) { i += 1; continue; }

    const tag = open[1].toLowerCase(), attrs = parseAttrs(open[2] || ""), selfClosed = open[3] === "/";
    const afterOpen = i + open[0].length;
    let inner = "", end = afterOpen;

    if (!voidTags.has(tag) && !selfClosed) {
      const closed = findClose(html, tag, afterOpen);
      if (!closed) { leftover.push(html.slice(i)); i = html.length; continue; }
      inner = closed.inner;
      end = closed.end;
    }

    const skip = ignoredTags.has(tag) || (tag === "script" && !attrs.src && !inner.trim());
    if (skip) { i = end; continue; }
    if (allowed.has(tag) && !hasInlineHandler(attrs)) result.nodes.push({ tag, attrs, inner });
    else leftover.push(html.slice(i, end));
    i = end;
  }

  result.leftover = leftover.join("\n");
  return result;
}

function styleObject(value: string): Record<string, string> {
  const style: Record<string, string> = {};
  value.split(";").forEach((rule) => {
    const at = rule.indexOf(":");
    if (at < 1) return;
    const name = rule.slice(0, at).trim(), raw = rule.slice(at + 1).trim();
    if (!name || !raw) return;
    style[name.startsWith("--") ? name : name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = raw;
  });
  return style;
}

/** Converts parsed HTML attributes into React props. */
export function toReactProps(attrs: Record<string, string>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "style") { props.style = styleObject(value); continue; }
    if (name.startsWith("data-") || name.startsWith("aria-")) { props[name] = value; continue; }
    const prop = propNames[name] || name;
    props[prop] = booleanProps.has(prop) ? value !== "false" : value;
  }
  return props;
}
