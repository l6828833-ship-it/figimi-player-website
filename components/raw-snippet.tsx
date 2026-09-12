"use client";

import { useEffect } from "react";

/**
 * Client-side fallback injector for the parts of an admin snippet that cannot be
 * server-rendered (inline `on*` handlers, exotic tags, unbalanced markup).
 *
 * Prefer CodeSnippet, which server-renders the snippet so verification meta tags
 * and ad loaders appear in the initial HTML. This component only runs after
 * hydration, so anything it injects is invisible to crawlers and verifiers.
 *
 * Only administrators can set this value (in Admin -> Settings).
 */
export function RawSnippet({ code, target }: { code: string; target: "head" | "body" }) {
  useEffect(() => {
    const trimmed = code?.trim();
    if (!trimmed) return;
    const parent = target === "head" ? document.head : document.body;
    const added: Node[] = [];

    const runScript = (attributes: NamedNodeMap | null, text: string) => {
      const script = document.createElement("script");
      if (attributes) Array.from(attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
      if (text) script.text = text;
      parent.appendChild(script);
      added.push(script);
    };

    if (trimmed.includes("<")) {
      const template = document.createElement("template");
      template.innerHTML = trimmed;
      Array.from(template.content.childNodes).forEach((node) => {
        if (node.nodeName === "SCRIPT") {
          const original = node as HTMLScriptElement;
          runScript(original.attributes, original.textContent || "");
        } else {
          const clone = node.cloneNode(true);
          parent.appendChild(clone);
          added.push(clone);
        }
      });
    } else {
      runScript(null, trimmed);
    }

    return () => added.forEach((node) => { try { node.parentNode?.removeChild(node); } catch { /* already removed */ } });
  }, [code, target]);

  return null;
}
