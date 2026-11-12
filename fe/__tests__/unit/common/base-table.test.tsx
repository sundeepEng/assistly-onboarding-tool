/**
 * BaseTable — commonComponents/base-table.tsx
 *
 * Every CRM, HCM and Compliance list screen renders through this component, so
 * the way it behaves when a list query is still loading or has failed decides
 * whether those screens degrade or white-screen.
 */


import BaseTable from "../../../commonComponents/base-table";
import { renderWithProviders, screen } from "../../test-utils/render";

interface Row {
  id: string;
  name: string;
}

const columns = [
  { header: "Name", field: "name" as const },
  { header: "Id", field: "id" as const },
];

const rows: Row[] = [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
];

describe("BaseTable — rendering", () => {
  it("renders a row per record", () => {
    renderWithProviders(<BaseTable columns={columns} data={rows} />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Grace")).toBeInTheDocument();
  });

  it("renders the column headers", () => {
    renderWithProviders(<BaseTable columns={columns} data={rows} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Id")).toBeInTheDocument();
  });

  it("shows the default empty message for an empty list", () => {
    renderWithProviders(<BaseTable columns={columns} data={[]} />);
    expect(screen.getByText("Nothing added yet.")).toBeInTheDocument();
  });

  it("prefers a caller-supplied empty message", () => {
    renderWithProviders(
      <BaseTable columns={columns} data={[]} customEmptyMessage="No leads yet." />
    );
    expect(screen.getByText("No leads yet.")).toBeInTheDocument();
  });

  it("treats undefined data as empty when no selection handler is attached", () => {
    // The `!Array.isArray(data)` guard covers the render path.
    renderWithProviders(
      <BaseTable columns={columns} data={undefined as unknown as Row[]} />
    );
    expect(screen.getByText("Nothing added yet.")).toBeInTheDocument();
  });
});

describe("BaseTable — row selection", () => {
  it("reports the selected rows to the caller", () => {
    const onRowSelectionChange = jest.fn();
    renderWithProviders(
      <BaseTable
        columns={columns}
        data={rows}
        checkbox
        onRowSelectionChange={onRowSelectionChange}
      />
    );
    // Mounts with nothing selected.
    expect(onRowSelectionChange).toHaveBeenCalledWith([]);
  });

  /**
   * Known defect — pinned so a fix is a deliberate change.
   *
   * The early return for a non-array `data` lives at the end of the component
   * body, but the selection effect runs regardless and calls `data.filter`
   * unguarded (base-table.tsx:55) — note the sibling `selectableCount` on line 49
   * *is* guarded with `data?.filter`, so the inconsistency is visible in-file.
   *
   * Any list screen that passes `onRowSelectionChange` therefore throws while its
   * query is loading or after it fails, white-screening the page instead of
   * showing the empty state or the error popover. This regressed in the merge
   * that brought in `isRowDisabled`/`resetSelectionKey`.
   *
   * Fix would be `data?.filter(...)` on line 55, matching line 49.
   */
  it("throws instead of degrading when data is undefined and selection is enabled", () => {
    const onRowSelectionChange = jest.fn();
    expect(() =>
      renderWithProviders(
        <BaseTable
          columns={columns}
          data={undefined as unknown as Row[]}
          checkbox
          onRowSelectionChange={onRowSelectionChange}
        />
      )
    ).toThrow(TypeError);
  });
});
