/**
 * Schemes that are safe to put in an href a visitor can click.
 *
 * `javascript:`, `data:` and `vbscript:` all execute in the page's origin. Zod's
 * `.url()` accepts every one of them — it validates that a string parses as a URL, not
 * that the URL is safe to link to — so nothing upstream of this stops a record whose
 * "canonical URL" is a script from reaching an anchor tag.
 */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * The URL if it is safe to link to, otherwise null.
 *
 * Every external link is built from a value some upstream API supplied, so the check
 * belongs at the point of rendering as well as at the point of ingestion: a row written
 * before the validator was tightened is still in the database.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    return SAFE_SCHEMES.has(new URL(trimmed).protocol) ? trimmed : null;
  } catch {
    // Not a URL at all. A relative path is not an external link either.
    return null;
  }
}

/** Whether a string is an http(s) URL. Used at the ingestion boundary. */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
