import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";

const tabs = [
  { id: "overview", label: "Overview", panel: <p>Overview panel</p> },
  { id: "trials", label: "Trials", panel: <p>Trials panel</p> },
  { id: "sources", label: "Sources", panel: <p>Sources panel</p> },
];

const tab = (name: string) => screen.getByRole("tab", { name });

function tabIndexes(): number[] {
  return screen.getAllByRole("tab").map((element) => element.tabIndex);
}

describe("Tabs", () => {
  it("keeps only the selected tab in the tab order and shows only its panel", () => {
    render(<Tabs tabs={tabs} label="Company sections" defaultTabId="trials" />);
    expect(screen.getByRole("tablist", { name: "Company sections" })).toBeInTheDocument();
    expect(tab("Trials")).toHaveAttribute("aria-selected", "true");
    expect(tab("Overview")).toHaveAttribute("aria-selected", "false");
    expect(tabIndexes()).toEqual([-1, 0, -1]);

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Trials panel");
    expect(panel).toHaveAttribute("aria-labelledby", tab("Trials").id);
    expect(tab("Trials")).toHaveAttribute("aria-controls", panel.id);
    expect(screen.getByText("Overview panel").closest("[role=tabpanel]")).toHaveAttribute("hidden");
  });

  it("moves selection and focus with the arrow keys, Home and End, wrapping at both ends", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} label="Sections" onChange={onChange} />);
    expect(tabIndexes()).toEqual([0, -1, -1]);
    tab("Overview").focus();

    fireEvent.keyDown(tab("Overview"), { key: "ArrowRight" });
    expect(tab("Trials")).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tab("Trials"));
    expect(tabIndexes()).toEqual([-1, 0, -1]);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Trials panel");

    fireEvent.keyDown(tab("Trials"), { key: "End" });
    expect(document.activeElement).toBe(tab("Sources"));

    fireEvent.keyDown(tab("Sources"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Overview"));

    fireEvent.keyDown(tab("Overview"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tab("Sources"));

    fireEvent.keyDown(tab("Sources"), { key: "Home" });
    expect(document.activeElement).toBe(tab("Overview"));
    expect(tabIndexes()).toEqual([0, -1, -1]);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview panel");

    expect(onChange.mock.calls.map((call) => call[0])).toEqual([
      "trials",
      "sources",
      "overview",
      "sources",
      "overview",
    ]);
  });

  it("selects on click and ignores keys outside the pattern", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} label="Sections" onChange={onChange} />);
    fireEvent.click(tab("Sources"));
    expect(tab("Sources")).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tab("Sources"));

    fireEvent.keyDown(tab("Sources"), { key: "ArrowDown" });
    expect(tab("Sources")).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("sources");
  });
});
