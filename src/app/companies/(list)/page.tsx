import type { Metadata } from "next";
import type { PageProps } from "@/app/_lib/page-props";
import { OrganizationDirectory } from "@/app/_lib/organization-directory";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({ searchParams }: PageProps) {
  return (
    <OrganizationDirectory
      searchParams={searchParams}
      config={{
        title: "Companies",
        description:
          "Neurotechnology companies with their technology categories, target indications, development stage, headquarters and disclosed funding. Amounts are shown only when disclosed.",
        route: routes.companies(),
        noun: { one: "company", many: "companies" },
        nameHeader: "Company",
        caption: "Company directory",
        idPrefix: "company",
        // Only organizations a source actually calls a company. Universities, hospitals
        // and agencies live in the organization directory.
        pinnedKinds: ["company"],
        emptyTitle: "No companies match",
        emptyFiltered: "Remove a filter or clear the search to see more companies.",
        emptyBare:
          "No source has recorded a company yet. Run `npm run corpus` to build the corpus.",
      }}
    />
  );
}
