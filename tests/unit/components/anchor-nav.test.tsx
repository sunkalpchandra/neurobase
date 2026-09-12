import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnchorNav } from "@/components/ui/anchor-nav";

const items = [
  { id: "overview", label: "Overview" },
  { id: "sources", label: "Sources" },
];

function setHash(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

function currentLinks(): string[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "location")
    .map((link) => link.textContent ?? "");
}

describe("AnchorNav", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("links to each section and marks the one matching the hash as the current location", () => {
    render(<AnchorNav items={items} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#overview", "#sources"]);
    expect(currentLinks()).toEqual([]);

    setHash("#sources");
    expect(currentLinks()).toEqual(["Sources"]);
    expect(screen.getByRole("link", { name: "Sources" })).toHaveAttribute(
      "aria-current",
      "location",
    );

    setHash("#overview");
    expect(currentLinks()).toEqual(["Overview"]);

    setHash("#elsewhere");
    expect(currentLinks()).toEqual([]);
  });

  it("reads the hash present on mount and takes a custom label", () => {
    window.location.hash = "#sources";
    render(<AnchorNav items={items} label="Sections" />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(currentLinks()).toEqual(["Sources"]);
  });
});
