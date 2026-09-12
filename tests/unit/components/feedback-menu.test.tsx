import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackMenu } from "@/components/entities/feedback-menu";
import type { FeedbackAction } from "@/components/entities/actions";

const item = (name: string) => screen.getByRole("menuitem", { name });

function renderMenu(action: FeedbackAction) {
  const { container } = render(
    <FeedbackMenu entityType="event" entityId="evt-1" action={action} />,
  );
  return {
    details: container.querySelector("details") as HTMLDetailsElement,
    summary: container.querySelector("summary") as HTMLElement,
    status: screen.getByRole("status"),
  };
}

describe("FeedbackMenu", () => {
  it("offers the three signals, calls the action with the chosen one and announces it", async () => {
    const action = vi.fn(() => Promise.resolve());
    const { details, summary, status } = renderMenu(action);
    // The announcement must live outside the <details>, which hides its content once closed.
    expect(details.contains(status)).toBe(false);

    details.open = true;
    await waitFor(() => expect(document.activeElement).toBe(item("More like this")));

    const items = screen.getAllByRole("menuitem");
    expect(items.map((menuitem) => menuitem.textContent)).toEqual([
      "More like this",
      "Less like this",
      "Hide",
    ]);
    expect(items.map((menuitem) => menuitem.tabIndex)).toEqual([0, -1, -1]);

    fireEvent.click(item("Less like this"));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({
        entityType: "event",
        entityId: "evt-1",
        signal: "less_like_this",
      }),
    );
    await waitFor(() => expect(status).toHaveTextContent("Noted: less like this."));
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it("announces a failure, closes and returns focus to the summary", async () => {
    const action = vi.fn(() => Promise.reject(new Error("offline")));
    const { details, summary, status } = renderMenu(action);
    details.open = true;
    await waitFor(() => expect(document.activeElement).toBe(item("More like this")));

    fireEvent.click(item("Hide"));
    await waitFor(() => expect(status).toHaveTextContent("Could not record feedback. Try again."));
    expect(details.contains(status)).toBe(false);
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it("moves through the items with the arrow keys, Home and End, and closes on Escape", async () => {
    const action = vi.fn(() => Promise.resolve());
    const { details, summary } = renderMenu(action);
    details.open = true;
    await waitFor(() => expect(document.activeElement).toBe(item("More like this")));

    fireEvent.keyDown(item("More like this"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("Less like this"));
    expect(screen.getAllByRole("menuitem").map((menuitem) => menuitem.tabIndex)).toEqual([
      -1, 0, -1,
    ]);

    fireEvent.keyDown(item("Less like this"), { key: "End" });
    expect(document.activeElement).toBe(item("Hide"));

    fireEvent.keyDown(item("Hide"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("More like this"));

    fireEvent.keyDown(item("More like this"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(item("Hide"));

    fireEvent.keyDown(item("Hide"), { key: "Home" });
    expect(document.activeElement).toBe(item("More like this"));

    fireEvent.keyDown(item("More like this"), { key: "Escape" });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(action).not.toHaveBeenCalled();
  });
});
