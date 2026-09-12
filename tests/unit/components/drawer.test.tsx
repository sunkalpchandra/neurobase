import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";

vi.mock("next/navigation", () => ({ usePathname: () => "/companies" }));

// jsdom does not implement the modal dialog API; emulate the observable parts. A real modal
// dialog moves focus inside itself, so the stub does too: only then is focus return observable.
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
  this.querySelector("button")?.focus();
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
});

function renderDrawer(id: string, triggerLabel: string, content = <p>Panel content</p>) {
  render(
    <>
      <DrawerTrigger drawerId={id}>{triggerLabel}</DrawerTrigger>
      <Drawer id={id} title={triggerLabel}>
        {content}
      </Drawer>
    </>,
  );
  const trigger = screen.getByRole("button", { name: triggerLabel });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: document.getElementById(id) as HTMLDialogElement };
}

describe("Drawer", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLDialogElement", HTMLDialogElement);
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = close;
    showModal.mockClear();
    close.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens with showModal, labels itself by its title, closes on Escape and returns focus", () => {
    const { trigger, dialog } = renderDrawer("filters", "Filters (2)");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-controls", "filters");
    expect(showModal).toHaveBeenCalledTimes(1);

    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelId = dialog.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(labelId)).toHaveTextContent("Filters (2)");

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(closeButton);
    expect(document.activeElement).not.toBe(trigger);

    fireEvent.keyDown(closeButton, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes from its close button and returns focus to the trigger", () => {
    const { trigger } = renderDrawer("menu", "Menu", <p>Links</p>);
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.click(closeButton);
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves an Escape that a nested widget already handled alone", () => {
    renderDrawer(
      "nested",
      "Menu",
      <input
        aria-label="Nested search"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.preventDefault();
        }}
      />,
    );
    const nested = screen.getByRole("textbox", { name: "Nested search" });
    fireEvent.keyDown(nested, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on clicks inside the panel", () => {
    const { dialog } = renderDrawer("panel", "Menu", <p>Links</p>);
    // The dialog box itself is reachable only through the backdrop: one child fills the panel.
    expect(dialog.children).toHaveLength(1);
    expect(dialog.firstElementChild).toContainElement(screen.getByText("Links"));

    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(200, 0, 384, 800));

    fireEvent.click(screen.getByText("Links"), { clientX: 300, clientY: 100 });
    expect(close).not.toHaveBeenCalled();

    // Empty space (or the scrollbar) inside the panel targets the dialog but lies within its box.
    fireEvent.click(dialog, { clientX: 300, clientY: 700 });
    expect(close).not.toHaveBeenCalled();

    fireEvent.click(dialog, { clientX: 50, clientY: 400 });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
