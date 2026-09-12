import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ImpactAssessment } from "@/domain/types";
import { ImpactExplanation } from "@/components/entities/impact-explanation";

const assessment: ImpactAssessment = {
  level: "high",
  explanation: "First reported human use of the interface with a regulatory milestone.",
  confidence: "moderate",
  confidenceRationale: "Two independent sources; results not yet peer reviewed.",
  components: [
    {
      component: "evidence_strength",
      level: "moderate",
      rationale: "Early feasibility data in three participants.",
    },
    {
      component: "regulatory_progress",
      level: "high",
      rationale: "Breakthrough designation granted.",
    },
  ],
  author: "language_model",
  assessedAt: "2026-03-12T10:00:00Z",
  sourceIds: ["src-1", "src-2"],
};

describe("ImpactExplanation", () => {
  it("labels the author visibly and lists component levels with rationales", () => {
    render(<ImpactExplanation assessment={assessment} />);
    expect(screen.getAllByText("AI-generated assessment").length).toBeGreaterThan(0);
    expect(screen.getByText("High potential impact")).toBeInTheDocument();
    expect(screen.getByText(/First reported human use/)).toBeInTheDocument();
    expect(screen.getByText("Moderate confidence")).toBeInTheDocument();
    expect(screen.getByText("Early feasibility data in three participants.")).toBeInTheDocument();
    expect(screen.getByText("Breakthrough designation granted.")).toBeInTheDocument();
    expect(screen.getByText("Regulatory progress").parentElement).toHaveTextContent(
      "Regulatory progress · High",
    );
    expect(screen.getByText(/based on 2 sources/)).toBeInTheDocument();
  });

  it("collapses to level and author when asked", () => {
    const { container } = render(<ImpactExplanation assessment={assessment} collapsed />);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(details?.querySelector("summary")).toHaveTextContent("High potential impact");
  });
});
