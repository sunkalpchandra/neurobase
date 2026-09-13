import type { Route } from "next";
import type { EntityType } from "@/domain/enums";

/**
 * Canonical routes. The search index stores hrefs produced here so results, feed
 * items and entity chips always link to the same place.
 */
export const routes = {
  home: () => "/",
  search: (params?: { q?: string; category?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category && params.category !== "all") search.set("category", params.category);
    const qs = search.toString();
    return qs ? `/search?${qs}` : "/search";
  },
  ask: (question?: string) => (question ? `/ask?q=${encodeURIComponent(question)}` : "/ask"),
  companies: () => "/companies",
  organizations: () => "/organizations",
  company: (slug: string) => `/companies/${encodeURIComponent(slug)}`,
  research: () => "/research",
  publication: (id: string) => `/research/${encodeURIComponent(id)}`,
  trials: () => "/trials",
  trial: (registryId: string) => `/trials/${encodeURIComponent(registryId)}`,
  devices: () => "/devices",
  device: (slug: string) => `/devices/${encodeURIComponent(slug)}`,
  patent: (id: string) => `/patents/${encodeURIComponent(id)}`,
  news: () => "/news",
  event: (slug: string) => `/news/${encodeURIComponent(slug)}`,
  source: (id: string) => `/sources/${encodeURIComponent(id)}`,
  researcher: (slug: string) => `/researchers/${encodeURIComponent(slug)}`,
  saved: () => "/saved",
} as const;

/**
 * Maps an entity to its page. `key` is the slug for slug-routed entities and the id
 * otherwise. Conditions and technology categories link to filtered search.
 */
export function hrefForEntity(entityType: EntityType, key: string): string {
  switch (entityType) {
    case "organization":
      return routes.company(key);
    case "device":
      return routes.device(key);
    case "clinical_trial":
      return routes.trial(key);
    case "publication":
      return routes.publication(key);
    case "patent":
      return routes.patent(key);
    case "event":
    case "news_article":
      return routes.event(key);
    case "source":
      return routes.source(key);
    case "researcher":
      return routes.researcher(key);
    case "funding_round":
    case "regulatory_action":
      return routes.event(key);
    case "condition":
      return `/search?conditions=${encodeURIComponent(key)}`;
    case "technology_category":
      return `/search?technologyCategories=${encodeURIComponent(key)}`;
  }
}

/** Narrows a computed path to Next's typed Route for <Link href>. Paths come from `routes`. */
export function toRoute(path: string): Route {
  return path as Route;
}

/** Appends a query string to a path, skipping empty values. */
export function withQuery(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export const PRIMARY_NAV = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Ask", href: "/ask" },
  { label: "Companies", href: "/companies" },
  { label: "Organizations", href: "/organizations" },
  { label: "Research", href: "/research" },
  { label: "Clinical trials", href: "/trials" },
  { label: "Devices", href: "/devices" },
  { label: "News", href: "/news" },
  { label: "Saved", href: "/saved" },
] as const;
