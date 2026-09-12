import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading search results">
      <header className="border-b border-line py-6">
        <Skeleton variant="line" width="8rem" height="1.5rem" />
        <div className="mt-2">
          <SkeletonLines count={2} />
        </div>
        <div className="mt-4 max-w-3xl">
          <Skeleton variant="block" height="2rem" />
        </div>
      </header>
      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <div className="hidden lg:block">
          <SkeletonLines count={8} />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-lg border border-line bg-surface px-4 py-3">
              <Skeleton variant="line" width="60%" height="1rem" />
              <div className="mt-2">
                <SkeletonLines count={2} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
