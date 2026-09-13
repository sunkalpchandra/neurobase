import type { Metadata } from "next";
import type { PageProps } from "@/app/_lib/page-props";
import { OrganizationDirectory } from "@/app/_lib/organization-directory";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Organizations" };
export const dynamic = "force-dynamic";

export default async function OrganizationsPage({ searchParams }: PageProps) {
  return (
    <OrganizationDirectory
      searchParams={searchParams}
      config={{
        title: "Organizations",
        description:
          "Every organization in the database: companies, universities, hospitals, agencies and the rest. Type is shown only where a source states one — a registry's sponsor class, an FDA applicant, or a catalogued institution — and is left blank otherwise.",
        route: routes.organizations(),
        noun: { one: "organization", many: "organizations" },
        nameHeader: "Organization",
        caption: "Organization directory",
        idPrefix: "organization",
        showKindColumn: true,
        emptyTitle: "No organizations match",
        emptyFiltered: "Remove a filter or clear the search to see more organizations.",
        emptyBare:
          "No source has recorded an organization yet. Run `npm run corpus` to build the corpus.",
      }}
    />
  );
}
