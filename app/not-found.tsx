import Link from "next/link";
export default function NotFound() { return <div className="shell narrow error-page"><span className="eyebrow">404</span><h1>That page could not be found</h1><p>The address may have changed, or the page may no longer exist.</p><Link className="button primary" href="/">Browse all tools</Link></div>; }
