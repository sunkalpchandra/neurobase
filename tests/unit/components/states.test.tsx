import Link from "next/link";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

describe("EmptyState", () => {
  it("names what is empty, what would fill it, and an optional action", () => {
    render(
      <EmptyState
        title="No clinical trials"
        description="Trials appear once a registry entry names this device."
        action={<Link href="/trials">Browse trials</Link>}
      />,
    );
    expect(screen.getByText("No clinical trials")).toBeInTheDocument();
    expect(screen.getByText(/Trials appear once/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse trials" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("is announced as an alert and calls the retry handler", () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Search is unavailable" description="Try again." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Search is unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders no retry button without a handler", () => {
    render(<ErrorState title="Failed" description="Nothing to retry." />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive technology and only pulses when motion is allowed", () => {
    const { container } = render(<Skeleton variant="block" />);
    const skeleton = container.firstElementChild;
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton?.className).toContain("motion-safe:animate-pulse");
  });
});
