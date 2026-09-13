import { safeExternalUrl } from "@/lib/urls";

/**
 * An anchor to a URL that came from an upstream record.
 *
 * Every external link on the site points at a value some API supplied. `javascript:`,
 * `data:` and `vbscript:` URLs all execute in the page's origin, and zod's `.url()`
 * accepts each of them, so the scheme is checked here as well as at ingestion — a row
 * written before the validator was tightened is still in the database.
 *
 * An unsafe or unparseable URL renders as plain text rather than disappearing: the
 * visitor still sees what the record says, they just cannot be made to click it.
 */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const safe = safeExternalUrl(href);
  if (!safe) return <span className={className}>{children}</span>;
  return (
    <a href={safe} rel="noreferrer" className={className}>
      {children}
    </a>
  );
}
