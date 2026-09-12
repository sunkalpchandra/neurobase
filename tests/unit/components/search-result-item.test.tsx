import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SearchResult } from "@/domain/types";
import { SearchResultItem } from "@/components/entities/search-result-item";

const result: SearchResult = {
  entityType: "device",
  entityId: "dev-1",
  href: "/devices/sample-array",
  title: "Sample cortical array",
  subtitle: "Sample Neural Systems",
  description: "A development-sample intracortical array.",
  snippetHtml: "Records from the <mark>motor cortex</mark> &amp; spinal targets",
  metadata: [
    { label: "Interface", value: "Intracortical array" },
    { label: "Stage", value: "Early feasibility" },
  ],
  entities: [{ type: "organization", id: "org-1", href: "/companies/sample", name: "Sample Co" }],
  evidenceStage: "early_human_feasibility",
  sourceTypes: ["peer_reviewed_paper"],
  verificationStatus: "machine_verified",
  updatedAt: "2026-02-01T00:00:00Z",
  publishedOn: null,
  isSample: true,
  score: {
    keyword: 0.8123,
    semantic: null,
    recency: 0.5,
    quality: 1,
    weights: { keyword: 0.55, semantic: 0.2, recency: 0.1, quality: 0.15 },
    final: 0.6468,
  },
};

describe("SearchResultItem", () => {
  it("renders the snippet's <mark> elements and nothing else as HTML", () => {
    const { container } = render(<SearchResultItem result={result} />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("motor cortex");
    expect(marks[0]?.parentElement).toHaveTextContent(
      "Records from the motor cortex & spinal targets",
    );
  });

  it("shows the typed title link, metadata, labels and the score breakdown", () => {
    render(<SearchResultItem result={result} />);
    expect(screen.getByRole("link", { name: "Sample cortical array" })).toHaveAttribute(
      "href",
      "/devices/sample-array",
    );
    expect(screen.getByText("Device")).toBeInTheDocument();
    expect(screen.getByText("Intracortical array")).toBeInTheDocument();
    expect(screen.getByText("Stage 5").parentElement).toHaveTextContent(
      "Stage 5 · Early human feasibility",
    );
    expect(screen.getByText("Machine-verified")).toBeInTheDocument();
    expect(screen.getByText("Development sample")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sample Co/ })).toHaveAttribute(
      "href",
      "/companies/sample",
    );
    expect(screen.getByText("Why this ranked here")).toBeInTheDocument();
    expect(screen.getByText("0.81 × 0.55")).toBeInTheDocument();
    expect(screen.getByText("not used")).toBeInTheDocument();
    expect(screen.getByText("0.65")).toBeInTheDocument();
  });
});
