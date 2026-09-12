import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

interface Row {
  id: string;
  name: string;
  count: number;
}

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", cell: (row) => row.name },
  { key: "count", header: "Trials", cell: (row) => row.count, align: "right" },
  { key: "actions", header: "Actions", cell: () => "Open", srOnlyHeader: true },
];

const rows: Row[] = [
  { id: "a", name: "Alpha Neural", count: 2 },
  { id: "b", name: "Beta Interfaces", count: 0 },
];

describe("DataTable", () => {
  it("renders a real table with scoped column headers and a caption", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        caption="Companies"
        emptyState={<p>Nothing</p>}
      />,
    );
    const table = screen.getByRole("table", { name: "Companies" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers).toHaveLength(3);
    headers.forEach((header) => expect(header).toHaveAttribute("scope", "col"));
    expect(within(table).getByText("Actions")).toHaveClass("sr-only");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(table.querySelector("caption")).toHaveTextContent("Companies");
  });

  it("renders the same rows as a stacked definition list with column headers as dt", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        caption="Companies"
        emptyState={<p>Nothing</p>}
      />,
    );
    const list = container.querySelector("ol");
    expect(list).not.toBeNull();
    expect(list?.className).toContain("md:hidden");
    const articles = list?.querySelectorAll("article") ?? [];
    expect(articles).toHaveLength(2);
    const firstTerms = Array.from(articles[0]?.querySelectorAll("dt") ?? []).map((dt) =>
      dt.textContent?.trim(),
    );
    expect(firstTerms).toEqual(["Name", "Trials", "Actions"]);
    expect(articles[0]?.querySelector("dd")).toHaveTextContent("Alpha Neural");
  });

  it("renders the empty state instead of a table when there are no rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        caption="Companies"
        emptyState={<p>No companies match these filters.</p>}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No companies match these filters.")).toBeInTheDocument();
  });
});
