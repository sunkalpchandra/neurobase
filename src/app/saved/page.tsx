import type { Metadata } from "next";
import Link from "next/link";
import { feedbackAction, followAction, saveAction } from "@/app/actions/personalization";
import { Section } from "@/app/_lib/section";
import { createPersonalizationRepository } from "@/data/personalization";
import { getDb } from "@/db/client";
import { ENTITY_TYPE_LABELS } from "@/domain/enums";
import type { FollowedEntity, SavedItem } from "@/domain/types";
import { pluralize } from "@/lib/format";
import { getProfileId } from "@/lib/profile";
import { routes, toRoute } from "@/lib/routes";
import { FeedItemCard } from "@/components/entities/feed-item-card";
import { FollowButton } from "@/components/entities/follow-button";
import { SaveButton } from "@/components/entities/save-button";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormattedDate } from "@/components/ui/formatted-date";
import { linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Saved" };
export const dynamic = "force-dynamic";

const savedColumns: DataTableColumn<SavedItem>[] = [
  {
    key: "title",
    header: "Item",
    cell: (item) => (
      <Link href={toRoute(item.href)} className="font-medium hover:underline">
        {item.title}
      </Link>
    ),
    width: "50%",
  },
  { key: "type", header: "Type", cell: (item) => ENTITY_TYPE_LABELS[item.entityType] },
  {
    key: "saved",
    header: "Saved",
    cell: (item) => <FormattedDate value={item.savedAt} />,
    width: "8rem",
  },
  {
    key: "actions",
    header: "Actions",
    srOnlyHeader: true,
    cell: (item) => (
      <SaveButton
        entityType={item.entityType}
        entityId={item.entityId}
        initialSaved
        action={saveAction}
      />
    ),
    align: "right",
  },
];

const followColumns: DataTableColumn<FollowedEntity>[] = [
  {
    key: "name",
    header: "Following",
    cell: (item) => (
      <Link href={toRoute(item.href)} className="font-medium hover:underline">
        {item.name}
      </Link>
    ),
    width: "50%",
  },
  { key: "type", header: "Type", cell: (item) => ENTITY_TYPE_LABELS[item.targetType] },
  {
    key: "since",
    header: "Since",
    cell: (item) => <FormattedDate value={item.followedAt} />,
    width: "8rem",
  },
  {
    key: "actions",
    header: "Actions",
    srOnlyHeader: true,
    cell: (item) => (
      <FollowButton
        targetType={item.targetType}
        targetId={item.targetId}
        initialFollowed
        action={followAction}
      />
    ),
    align: "right",
  },
];

export default async function SavedPage() {
  const profileId = await getProfileId();
  const repository = createPersonalizationRepository(getDb());
  const [saved, follows, forYou] = profileId
    ? await Promise.all([
        repository.listSaved(profileId),
        repository.listFollows(profileId),
        repository.forYou(profileId, 10),
      ])
    : [[], [], []];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Saved"
        description="Items you saved, entities you follow, and developments recommended from them. Saved state lives in an anonymous profile on this browser; signing in is not required."
        meta={
          <>
            <span>{pluralize(saved.length, "saved item")}</span>
            <span>{pluralize(follows.length, "followed entity", "followed entities")}</span>
          </>
        }
      />

      <Section id="saved-items" title="Saved items" className="border-t-0">
        <DataTable
          columns={savedColumns}
          rows={saved}
          rowKey={(item) => item.id}
          caption="Saved items"
          emptyState={
            <EmptyState
              title="Nothing saved yet"
              description="Use Save on any development, company, device, trial or paper to keep it here."
              action={
                <Link href={toRoute(routes.home())} className={linkClass}>
                  Go to the research feed
                </Link>
              }
            />
          }
        />
      </Section>

      <Section id="following" title="Following">
        <DataTable
          columns={followColumns}
          rows={follows}
          rowKey={(item) => item.id}
          caption="Followed entities"
          emptyState={
            <EmptyState
              title="Not following anything"
              description="Follow a company from its profile to see its developments recommended below. Following topics, researchers, labs, devices, conditions and trials uses the same model."
              action={
                <Link href={toRoute(routes.companies())} className={linkClass}>
                  Browse companies
                </Link>
              }
            />
          }
        />
      </Section>

      <Section
        id="for-you"
        title="For you"
        description="Developments linked to what you follow or saved. Each item says why it appeared; “More like this”, “Less like this” and “Hide” adjust future recommendations."
      >
        {forYou.length === 0 ? (
          <EmptyState
            title="No recommendations yet"
            description="Recommendations appear once you follow or save something with linked developments."
          />
        ) : (
          <ol className="flex flex-col gap-3" aria-label="Recommended developments">
            {forYou.map((item) => (
              <li key={item.id}>
                <FeedItemCard item={item} saveAction={saveAction} feedbackAction={feedbackAction} />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
