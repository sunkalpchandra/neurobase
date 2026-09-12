import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { microLabelClass, panelClass } from "./styles";

export type DataTableAlign = "left" | "right" | "center";

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: DataTableAlign;
  /** CSS width for the table column, e.g. "12rem" or "20%". */
  width?: string;
  /** Keep the header for assistive technology only (e.g. an actions column). */
  srOnlyHeader?: boolean;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Describes the table; hidden visually unless captionVisible is set. */
  caption: ReactNode;
  captionVisible?: boolean;
  /** Rendered instead of the table when rows is empty. */
  emptyState: ReactNode;
  className?: string;
}

const alignClasses: Record<DataTableAlign, string> = {
  left: "text-left",
  right: "text-right tabular",
  center: "text-center",
};

/**
 * Responsive table. From md: a real <table> with column headers; below md: the same rows as
 * stacked <article>/<dl> records. Both are server-rendered and toggled with CSS only.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  captionVisible = false,
  emptyState,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className={className}>
      <div className={cn("hidden overflow-x-auto md:block", panelClass)}>
        <table className="w-full text-sm">
          <caption
            className={
              captionVisible
                ? "border-b border-line px-3 py-2 text-left text-sm font-semibold text-ink"
                : "sr-only"
            }
          >
            {caption}
          </caption>
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    "border-b border-line px-3 py-2 font-medium",
                    microLabelClass,
                    alignClasses[column.align ?? "left"],
                  )}
                >
                  {column.srOnlyHeader ? (
                    <span className="sr-only">{column.header}</span>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-line-soft last:border-b-0 hover:bg-surface-hover"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-3 py-2 align-top", alignClasses[column.align ?? "left"])}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol
        className="flex flex-col gap-2 md:hidden"
        aria-label={typeof caption === "string" ? caption : undefined}
      >
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <article className={cn(panelClass, "px-3 py-2")}>
              <dl className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-3 gap-y-1 text-sm">
                {columns.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className={cn(microLabelClass, "pt-0.5", column.srOnlyHeader && "sr-only")}>
                      {column.header}
                    </dt>
                    <dd className={cn("min-w-0", column.align === "right" && "tabular")}>
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
