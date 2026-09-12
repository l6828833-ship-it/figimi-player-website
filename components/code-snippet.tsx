import { createElement, type HTMLAttributes, type ReactNode } from "react";
import { parseSnippet, toReactProps, voidTags } from "@/lib/html-snippet";
import { RawSnippet } from "./raw-snippet";

/**
 * Renders an administrator-provided code snippet (any ad network, analytics
 * tool, verification meta tag, or pixel) into the server-rendered HTML.
 *
 * Server rendering matters for two reasons:
 *  1. Verification `<meta>` tags are only accepted by ad networks and search
 *     consoles when they exist in the initial HTML response.
 *  2. Ad loader scripts start earlier, so slots fill before hydration.
 *
 * Markup the parser will not render server-side (inline `on*` handlers, exotic
 * tags, unbalanced HTML) is passed to the client injector so nothing is lost.
 */
export function CodeSnippet({ code, target }: { code: string; target: "head" | "body" }) {
  const { nodes, leftover } = parseSnippet(code, target);
  if (!nodes.length && !leftover) return null;
  return (
    <>
      {nodes.map((node, index): ReactNode => {
        const props: Record<string, unknown> = toReactProps(node.attrs);
        props.key = `${target}-${node.tag}-${index}`;
        if (node.inner && !voidTags.has(node.tag)) props.dangerouslySetInnerHTML = { __html: node.inner };
        // Tag names and attributes are dynamic, so React's typed JSX cannot be
        // used here; createElement receives the already-normalised props.
        return createElement(node.tag, props as unknown as HTMLAttributes<HTMLElement>);
      })}
      {leftover && <RawSnippet code={leftover} target={target} />}
    </>
  );
}
