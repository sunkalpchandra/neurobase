import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";
import { ConfidenceLabel } from "@/components/entities/confidence-label";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { SampleDataNotice } from "@/components/entities/sample-data-notice";
import { VerificationLabel } from "@/components/entities/verification-label";

describe("Badge", () => {
  it("renders a span with visible text for every variant", () => {
    render(
      <>
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="critical">Critical</Badge>
      </>,
    );
    const success = screen.getByText("Success");
    expect(success.tagName).toBe("SPAN");
    expect(success).toHaveAttribute("data-variant", "success");
    expect(success.className).toContain("text-success");
    expect(screen.getByText("Critical").className).toContain("text-critical");
    expect(screen.getByText("Warning").className).toContain("text-warning");
    expect(screen.getByText("Accent").className).toContain("text-accent");
    expect(screen.getByText("Neutral").className).toContain("text-ink-secondary");
  });

  it("supports the small size", () => {
    render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small").className).toContain("text-2xs");
  });
});

describe("EvidenceStageLabel", () => {
  it("shows the stage number and name", () => {
    render(<EvidenceStageLabel stage="early_human_feasibility" />);
    expect(screen.getByText("Stage 5").parentElement).toHaveTextContent(
      "Stage 5 · Early human feasibility",
    );
  });

  it("numbers the first and last stages from the ordered enum", () => {
    const { rerender } = render(<EvidenceStageLabel stage="concept" />);
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
    rerender(<EvidenceStageLabel stage="clinical_or_commercial_use" />);
    expect(screen.getByText("Stage 8")).toBeInTheDocument();
  });
});

describe("VerificationLabel", () => {
  it("maps each status to the badge variant with that meaning", () => {
    render(
      <>
        <VerificationLabel status="editor_verified" />
        <VerificationLabel status="machine_verified" />
        <VerificationLabel status="unverified" />
        <VerificationLabel status="disputed" />
        <VerificationLabel status="retracted" />
      </>,
    );
    expect(screen.getByText("Editor-verified")).toHaveAttribute("data-variant", "success");
    expect(screen.getByText("Machine-verified")).toHaveAttribute("data-variant", "success");
    expect(screen.getByText("Unverified")).toHaveAttribute("data-variant", "warning");
    expect(screen.getByText("Disputed")).toHaveAttribute("data-variant", "critical");
    expect(screen.getByText("Retracted")).toHaveAttribute("data-variant", "critical");
  });
});

describe("ConfidenceLabel and SampleDataNotice", () => {
  it("always carry their meaning as text", () => {
    render(
      <>
        <ConfidenceLabel confidence="high" />
        <SampleDataNotice />
        <SampleDataNotice variant="sentence" />
      </>,
    );
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getAllByText(/Development sample/)).toHaveLength(2);
  });
});
