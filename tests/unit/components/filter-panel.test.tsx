import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterPanel } from "@/components/shell/filter-panel";

describe("FilterPanel", () => {
  it("preserves other query params as hidden inputs and reflects selected filters", () => {
    const { container } = render(
      <FilterPanel
        action="/search"
        clearHref="/search?q=cortical"
        preserve={{
          q: "cortical",
          category: "devices",
          invasiveness: ["noninvasive"],
          sort: undefined,
          cursor: "",
        }}
        groups={[
          {
            key: "invasiveness",
            label: "Invasiveness",
            selected: ["noninvasive"],
            options: [
              { value: "invasive", label: "Invasive", count: 4 },
              { value: "noninvasive", label: "Noninvasive", count: 9 },
            ],
          },
          {
            key: "organizationKind",
            label: "Organization kind",
            kind: "select",
            selected: ["company"],
            options: [
              { value: "company", label: "Company" },
              { value: "university", label: "University" },
            ],
          },
        ]}
        dateRange={{
          label: "Published",
          fromKey: "publishedFrom",
          toKey: "publishedTo",
          from: "2025-01-01",
          to: null,
        }}
      />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/search");

    const hidden = Array.from(form.querySelectorAll('input[type="hidden"]')).map((input) => [
      input.getAttribute("name"),
      input.getAttribute("value"),
    ]);
    expect(hidden).toEqual([
      ["q", "cortical"],
      ["category", "devices"],
    ]);

    const data = new FormData(form);
    expect(data.getAll("invasiveness")).toEqual(["noninvasive"]);
    expect(data.get("organizationKind")).toBe("company");
    expect(data.get("publishedFrom")).toBe("2025-01-01");
    expect(data.get("q")).toBe("cortical");

    expect(screen.getByRole("checkbox", { name: /Noninvasive/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Invasive/ })).not.toBeChecked();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/search?q=cortical",
    );
    expect(screen.getByRole("button", { name: "Apply filters" })).toHaveAttribute("type", "submit");
  });
});
