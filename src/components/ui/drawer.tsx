"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { cn } from "@/lib/cn";
import { Button, type ButtonProps } from "./button";

/** Element that opened each dialog, so focus can return to it on close. */
const openers = new WeakMap<HTMLDialogElement, HTMLElement>();

function findDialog(drawerId: string): HTMLDialogElement | null {
  const element = document.getElementById(drawerId);
  return element instanceof HTMLDialogElement ? element : null;
}

/** A click on the ::backdrop targets the dialog itself but lands outside the dialog's box. */
function isBackdropClick(event: MouseEvent<HTMLDialogElement>): boolean {
  if (event.target !== event.currentTarget) return false;
  const box = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

export interface DrawerTriggerProps extends Omit<ButtonProps, "onClick"> {
  /** Id of the Drawer this button opens. */
  drawerId: string;
}

/** Button that opens the Drawer with the matching id. Usable directly from server components. */
export function DrawerTrigger({ drawerId, children, ...rest }: DrawerTriggerProps) {
  return (
    <Button
      aria-haspopup="dialog"
      aria-controls={drawerId}
      onClick={(event) => {
        const dialog = findDialog(drawerId);
        if (!dialog) return;
        openers.set(dialog, event.currentTarget);
        dialog.showModal();
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

export interface DrawerProps {
  id: string;
  title: string;
  children: ReactNode;
  side?: "left" | "right";
  /** Close automatically when the route changes, e.g. after a navigation link inside. */
  closeOnNavigate?: boolean;
  className?: string;
}

/**
 * Side panel built on a native modal <dialog>: the browser traps focus and marks the page inert.
 * Escape closes, the backdrop closes, and focus returns to the DrawerTrigger that opened it.
 */
export function Drawer({
  id,
  title,
  children,
  side = "right",
  closeOnNavigate = false,
  className,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const titleId = `${id}-title`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (closeOnNavigate && dialog?.open) dialog.close();
  }, [pathname, closeOnNavigate]);

  const close = () => dialogRef.current?.close();

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    // An Escape a nested widget already consumed (e.g. to dismiss its own list) must not close the drawer.
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    close();
  };

  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (isBackdropClick(event)) close();
  };

  const handleClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    const opener = openers.get(event.currentTarget);
    if (opener?.isConnected) opener.focus();
  };

  return (
    <dialog
      id={id}
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onClose={handleClose}
      className={cn(
        "fixed inset-y-0 m-0 h-dvh max-h-none w-full max-w-sm overflow-y-auto border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40",
        side === "right" ? "right-0 left-auto border-l" : "left-0 right-auto border-r",
        className,
      )}
    >
      {/* Fills the panel so clicks on empty space below the content never target the dialog. */}
      <div className="flex min-h-full flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={close}>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
              <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Close
          </Button>
        </div>
        <div className="flex-1 px-4 py-4">{children}</div>
      </div>
    </dialog>
  );
}
