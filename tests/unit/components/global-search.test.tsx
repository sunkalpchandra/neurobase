import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "@/components/shell/global-search";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const DEBOUNCE_MS = 200;

function jsonResponse(suggestions: unknown[]): Response {
  return new Response(JSON.stringify({ suggestions }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function getInput() {
  return screen.getByRole("combobox", { name: "Search NeuroBase" });
}

describe("GlobalSearch", () => {
  it("is a labelled search form that submits q to /search by GET", () => {
    render(<GlobalSearch />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");

    const input = getInput();
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.change(input, { target: { value: "cortical array" } });
    expect(new FormData(form as HTMLFormElement).get("q")).toBe("cortical array");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("fetches suggestions after a debounce and navigates with Enter on the active option", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(() =>
      Promise.resolve(
        jsonResponse([
          { title: "Sample device", entityType: "device", href: "/devices/sample" },
          { title: "Sample company", entityType: "organization", href: "/companies/sample" },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<GlobalSearch />);
      const input = getInput();
      input.focus();
      fireEvent.change(input, { target: { value: "sam" } });
      expect(fetchMock).not.toHaveBeenCalled();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/suggest?q=sam&limit=6");
      await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
      expect(screen.getAllByRole("option")).toHaveLength(2);

      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1]?.id);
      fireEvent.keyDown(input, { key: "Enter" });
      expect(push).toHaveBeenCalledWith("/companies/sample");
      expect(input).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("closes the list silently when a later suggest request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse([{ title: "Neural probe", entityType: "device", href: "/devices/probe" }]),
        ),
      )
      .mockImplementationOnce(() => Promise.reject(new Error("network")));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<GlobalSearch />);
      const input = getInput();
      input.focus();
      fireEvent.change(input, { target: { value: "neu" } });
      await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));

      fireEvent.change(input, { target: { value: "neur" } });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "false"));
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("neither fetches nor opens for a prefilled value until the user types", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(() =>
      Promise.resolve(
        jsonResponse([{ title: "Cortical array", entityType: "device", href: "/devices/array" }]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<GlobalSearch defaultValue="cortical" />);
      const input = getInput();
      expect(input).toHaveValue("cortical");

      await act(() => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 100)));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(input).toHaveAttribute("aria-expanded", "false");

      input.focus();
      fireEvent.change(input, { target: { value: "cortical a" } });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/suggest?q=cortical+a&limit=6");
      await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the list closed when results arrive after the input lost focus", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <>
          <GlobalSearch />
          <button type="button">Elsewhere</button>
        </>,
      );
      const input = getInput();
      input.focus();
      fireEvent.change(input, { target: { value: "neu" } });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
      await act(async () => {
        resolveFetch(
          jsonResponse([{ title: "Neural probe", entityType: "device", href: "/devices/probe" }]),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryAllByRole("option")).toHaveLength(0);

      // The suggestions were kept: returning to the input shows them.
      act(() => input.focus());
      expect(input).toHaveAttribute("aria-expanded", "true");
      expect(screen.getAllByRole("option")).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
