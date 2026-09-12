import { describe, expect, it } from "vitest";
import { HEADLINE_OPTIONS, escapeHtml, headlineOptions, sanitizeSnippet } from "./snippets";

describe("sanitizeSnippet", () => {
  it("keeps mark tags and escapes everything else", () => {
    expect(sanitizeSnippet("a <mark>match</mark> here")).toBe("a <mark>match</mark> here");
    expect(sanitizeSnippet('<script>alert("x")</script> <mark>ok</mark>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; <mark>ok</mark>",
    );
  });

  it("neutralises tags that look like mark but are not exactly mark", () => {
    expect(sanitizeSnippet("<mark onclick=x>bad</mark>")).toBe("&lt;mark onclick=x&gt;bad</mark>");
    expect(sanitizeSnippet("<MARK>x</MARK>")).toBe("&lt;MARK&gt;x&lt;/MARK&gt;");
    expect(sanitizeSnippet("<img src=x onerror=alert(1)>")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });

  it("does not double-escape entities produced by the SQL-side escaping", () => {
    expect(sanitizeSnippet("&lt;b&gt; &amp; &#39;q&#39; &#x27;")).toBe(
      "&lt;b&gt; &amp; &#39;q&#39; &#x27;",
    );
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("&notanentity")).toBe("&amp;notanentity");
  });

  it("exposes the ts_headline options string", () => {
    expect(headlineOptions()).toBe(HEADLINE_OPTIONS);
    expect(HEADLINE_OPTIONS).toBe(
      "StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=24,MinWords=8",
    );
  });
});
