import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRIMARY_NAV } from "@/lib/routes";
import { PrimaryNav } from "@/components/shell/primary-nav";

const navigation = vi.hoisted(() => ({ pathname: "/" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

/** [label, aria-current] of every link that carries aria-current. */
function currentLinks(): Array<[string | null, string | null]> {
  return screen
    .getAllByRole("link")
    .filter((link) => link.hasAttribute("aria-current"))
    .map((link) => [link.textContent, link.getAttribute("aria-current")]);
}

describe("PrimaryNav", () => {
  it("lists every primary route and marks only the section containing the current path", () => {
    navigation.pathname = "/companies/acme";
    render(<PrimaryNav />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      PRIMARY_NAV.map((item) => item.href),
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toContainElement(links[0] ?? null);
    expect(currentLinks()).toEqual([["Companies", "page"]]);
  });

  it("marks Home only on the root path", () => {
    navigation.pathname = "/";
    render(<PrimaryNav />);
    expect(currentLinks()).toEqual([["Home", "page"]]);
  });

  it("does not treat a shared prefix as the same section", () => {
    navigation.pathname = "/newsletter";
    render(<PrimaryNav />);
    expect(currentLinks()).toEqual([]);
  });

  it("marks nothing without a pathname and takes a custom label and orientation", () => {
    navigation.pathname = null;
    render(<PrimaryNav orientation="vertical" label="Primary (menu)" />);
    expect(screen.getByRole("navigation", { name: "Primary (menu)" })).toBeInTheDocument();
    expect(currentLinks()).toEqual([]);
  });
});
