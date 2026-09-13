import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";

/**
 * This lives in a `(list)` route group, not in `companies/`, on purpose.
 *
 * A `loading.tsx` at the segment level wraps every route beneath it, including
 * `companies/[slug]`. That Suspense boundary makes Next flush the shell — and with it
 * the 200 — before the page body runs, so `notFound()` on an unknown company could no
 * longer set the status: `/companies/does-not-exist` answered 200 with a skeleton.
 * The group scopes the boundary to the list page, which is the only page it was for.
 */

export default function CompaniesLoading() {
  return (
    <div
      className="flex flex-col"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading companies"
    >
      <header className="border-b border-line py-6">
        <Skeleton variant="line" width="10rem" height="1.5rem" />
        <div className="mt-2 max-w-prose">
          <SkeletonLines count={2} />
        </div>
      </header>
      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <div className="hidden lg:block">
          <SkeletonLines count={10} />
        </div>
        <div>
          <Skeleton variant="block" height="2rem" />
          <div className="mt-3 rounded-lg border border-line bg-surface p-3">
            <SkeletonLines count={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
