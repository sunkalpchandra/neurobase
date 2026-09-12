import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetadataList } from "@/components/ui/metadata-list";

describe("MetadataList", () => {
  it("renders label/value pairs in a definition list with links and dashes for missing values", () => {
    const { container } = render(
      <MetadataList
        items={[
          { label: "Registry id", value: "NCT00000000", mono: true, href: "/trials/NCT00000000" },
          { label: "Website", value: "example.org", href: "https://example.org" },
          { label: "Founded", value: null },
        ]}
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    const internal = screen.getByRole("link", { name: "NCT00000000" });
    expect(internal).toHaveAttribute("href", "/trials/NCT00000000");
    expect(internal.closest("dd")?.className).toContain("font-mono");
    expect(screen.getByRole("link", { name: "example.org" })).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("Founded").nextElementSibling).toHaveTextContent("—");
  });
});
