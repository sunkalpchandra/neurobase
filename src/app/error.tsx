"use client";

import { routes } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="py-12">
      <ErrorState
        title="This page could not be loaded"
        description={
          error.digest
            ? `Something failed while rendering the page (reference ${error.digest}). Retry, or go back to the feed.`
            : "Something failed while rendering the page. Retry, or go back to the feed."
        }
        onRetry={reset}
        action={
          <ButtonLink href={routes.home()} variant="ghost" size="sm">
            Go to the feed
          </ButtonLink>
        }
      />
    </div>
  );
}
