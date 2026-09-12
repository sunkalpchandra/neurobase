import type { Metadata } from "next";
import { routes } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="py-12">
      <EmptyState
        title="Page not found"
        description="The address does not match a company, device, trial, publication, patent, development or source in NeuroBase. It may have moved or never existed."
        action={
          <>
            <ButtonLink href={routes.search()} variant="primary" size="sm">
              Search NeuroBase
            </ButtonLink>
            <ButtonLink href={routes.home()} variant="secondary" size="sm">
              Go to the feed
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
