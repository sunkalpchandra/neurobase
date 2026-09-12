import type { ISODate, ISOTimestamp } from "@/domain/types";
import { formatDate, formatMonthYear, toIsoDate } from "@/lib/format";

export interface FormattedDateProps {
  value: ISODate | ISOTimestamp | null | undefined;
  /** "date" → "12 Mar 2026"; "month" → "Mar 2026". */
  format?: "date" | "month";
  className?: string;
}

/** <time> element with a machine-readable dateTime; unknown dates render "—". */
export function FormattedDate({ value, format = "date", className }: FormattedDateProps) {
  if (!value) return <span className={className}>—</span>;
  const label = format === "month" ? formatMonthYear(value) : formatDate(value);
  return (
    <time dateTime={toIsoDate(value)} className={className}>
      {label}
    </time>
  );
}
