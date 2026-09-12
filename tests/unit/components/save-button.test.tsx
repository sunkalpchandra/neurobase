import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowButton } from "@/components/entities/follow-button";
import { SaveButton } from "@/components/entities/save-button";

describe("SaveButton", () => {
  it("toggles aria-pressed optimistically and calls the action with saved=true", async () => {
    let resolve: (value: { saved: boolean }) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<{ saved: boolean }>((done) => {
          resolve = done;
        }),
    );
    render(
      <SaveButton
        entityType="organization"
        entityId="org-1"
        initialSaved={false}
        action={action}
      />,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(button).toHaveTextContent("Saved");
    expect(action).toHaveBeenCalledWith({
      entityType: "organization",
      entityId: "org-1",
      saved: true,
    });

    await act(async () => {
      resolve({ saved: true });
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("reverts when the action fails and announces the failure", async () => {
    const action = vi.fn(() => Promise.reject(new Error("offline")));
    render(
      <SaveButton entityType="device" entityId="dev-1" initialSaved={false} action={action} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Could not update saved items"),
    );
    // The optimistic revert may commit after the announcement; wait for it rather than assume.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false"),
    );
  });
});

describe("FollowButton", () => {
  it("calls the action with followed=false when unfollowing", async () => {
    const action = vi.fn(() => Promise.resolve({ followed: false }));
    render(
      <FollowButton targetType="organization" targetId="org-1" initialFollowed action={action} />,
    );
    const button = screen.getByRole("button", { name: "Following" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(action).toHaveBeenCalledWith({
      targetType: "organization",
      targetId: "org-1",
      followed: false,
    });
  });
});
