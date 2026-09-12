import type { ReactNode } from "react";
import { decodeCursor, encodeCursor } from "@/data/pagination";
import type { PageInfo } from "@/domain/types";
import { pluralize } from "@/lib/format";
import { toRoute } from "@/lib/routes";
import { Pagination } from "@/components/ui/pagination";

export interface ListPaginationProps {
  cursor: string | null;
  pageSize: number;
  pageInfo: PageInfo;
  itemCount: number;
  hrefForCursor: (cursor: string | null) => string;
  noun: string;
  plural?: string;
  label: string;
}

/** Previous/next controls and a position summary for offset-cursor listings. */
export function ListPagination({
  cursor,
  pageSize,
  pageInfo,
  itemCount,
  hrefForCursor,
  noun,
  plural,
  label,
}: ListPaginationProps): ReactNode {
  const offset = decodeCursor(cursor);
  const total = pageInfo.totalCount ?? itemCount;
  if (total <= pageSize) return null;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + itemCount, total);
  const previousHref =
    offset > 0
      ? toRoute(hrefForCursor(offset - pageSize > 0 ? encodeCursor(offset - pageSize) : null))
      : null;
  const nextHref = pageInfo.nextCursor ? toRoute(hrefForCursor(pageInfo.nextCursor)) : null;
  return (
    <Pagination
      className="mt-4"
      previousHref={previousHref}
      nextHref={nextHref}
      summary={`Showing ${first}–${last} of ${pluralize(total, noun, plural)}`}
      label={label}
    />
  );
}
