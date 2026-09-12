import Link from "next/link";
import { routes, toRoute } from "@/lib/routes";
import { EmptyState } from "@/components/ui/empty-state";
import { linkClass } from "@/components/ui/styles";

export default function CompanyNotFound() {
  return (
    <div className="py-10">
      <EmptyState
        title="Company not found"
        description="No company profile exists at this address. It may have been merged or renamed."
        action={
          <Link href={toRoute(routes.companies())} className={linkClass}>
            Browse the company directory
          </Link>
        }
      />
    </div>
  );
}
