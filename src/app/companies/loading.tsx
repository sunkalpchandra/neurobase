import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";

export default function CompaniesLoading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading companies">
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
