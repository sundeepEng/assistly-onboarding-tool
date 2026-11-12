import React, { ReactNode, useEffect, useState } from "react";
import InputcheckboxComponent from "./input-checkbox-component";

interface Column<T> {
  header?: string; // Header text for the column
  field?: keyof T; // Field name in the data object
  minWidth?: string; // Minimum width for the column
  render?: (value: any, row: T, index: number) => React.ReactNode; // Custom render function
  headerClassName?: string;
}

interface BaseTableProps<T> {
  columns: Column<T>[]; // Array of column definitions
  data: T[]; // Array of data objects
  headerStyles?: string; // Custom header styles
  rowStyles?: (row: T, index: number) => string; // Dynamic row styles
  cellStyles?: (field: keyof T, value: any, row: T) => string; // Dynamic cell styles
  tableContainerClass?: string;
  checkbox?: boolean;
  setActiveBulkCampaign?: any;
  onRowSelectionChange?: (selectedRows: T[]) => void;
  customEmptyMessage?: string;
  resetSelectionKey?: number;
  isRowDisabled?: (row: T, index: number) => boolean; // Function to determine if a row's checkbox should be disabled
}

const BaseTable = <T extends object>({
  columns,
  data,
  headerStyles = "",
  rowStyles = () => "",
  cellStyles = () => "",
  tableContainerClass,
  checkbox,
  setActiveBulkCampaign,
  onRowSelectionChange,
  customEmptyMessage,
  resetSelectionKey,
  isRowDisabled,
}: BaseTableProps<T>) => {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
  setSelectedRows(new Set<number>());
  setActiveBulkCampaign?.(false);
  onRowSelectionChange?.([]);
  }, [resetSelectionKey]);

  const selectableCount = data?.filter((row, index) => !isRowDisabled || !isRowDisabled(row, index)).length || 0;
  const allSelected = selectableCount > 0 && selectedRows.size === selectableCount;
  const isIndeterminate =
    selectedRows.size > 0 && selectedRows.size < selectableCount;
  useEffect(() => {
    if (onRowSelectionChange) {
      const selected = data.filter((row, index) => selectedRows.has(index));
      onRowSelectionChange(selected);
    }
  }, [selectedRows, data, onRowSelectionChange]);

  // Toggle all rows
  const toggleAllRows = () => {
    if (allSelected) {
      setSelectedRows(new Set());
      setActiveBulkCampaign?.(false);
    } else {
      // Only select rows that are not disabled
      const selectableIndices = data
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => !isRowDisabled || !isRowDisabled(row, index))
        .map(({ index }) => index);
      
      setSelectedRows(new Set(selectableIndices));
      setActiveBulkCampaign?.(selectableIndices.length > 0);
    }
  };
  // Toggle single row
  const toggleRow = (index: number) => {
    const row = data[index];
    if (isRowDisabled && isRowDisabled(row, index)) {
      return; // Don't allow selection if row is disabled
    }
    
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);

      setActiveBulkCampaign?.(next.size > 0);
      return next;
    });
  };
  // Generate dynamic grid template columns with min-width
  const gridTemplate = columns
    .map((col) => `minmax(${col.minWidth || "auto"}, 1fr)`)
    .join(" ");

  // Helper function to safely render cell content
  const renderCellContent = (value: any): ReactNode => {
    if (value === null || value === undefined) return null;
    return value as ReactNode;
  };

  if (!Array.isArray(data) || data?.length === 0) {
    return (
      <div className="p-4 text-[#9C9999] text-[25px] font-medium font-poppins text-center">
        {customEmptyMessage || "Nothing added yet."}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto w-full ${tableContainerClass}`}>
      <div className={`flex border-b border-solid  ${headerStyles}`}>
        {checkbox && (
          <div className="flex justify-center items-center w-[50px]">
            <InputcheckboxComponent
              value={allSelected}
              label=""
              onChange={toggleAllRows}
              indeterminate={isIndeterminate}
              name={""}
            />
          </div>
        )}
        {/* Table Header */}
        <div
          className={` grid bg-gray-100 font-jakarta text-black text-[18px] `}
          style={{ display: "grid", gridTemplateColumns: gridTemplate }}
        >
          {columns?.map((col, index) => (
            <div
              key={String(col.field ?? col.header ?? index)}
              className={`flex  py-2 border-gray-300 justify-start ${
                col.headerClassName || ""
              }`}
            >
              {col?.header || ""}
            </div>
          ))}
        </div>
      </div>
      {/* <hr className="border"/> */}

      {/* Table Body */}
      <div>
        {data?.map((row, rowIndex) => {
          const rowKey = String(
            (row as any)?.id ?? (row as any)?._id ?? rowIndex,
          );
          return (
            <div
              key={rowKey}
              className={`flex border-b border-solid pt-[5px] ${rowStyles(row, rowIndex)}`}
            >
              {checkbox && (
                <div className="flex justify-center items-center w-[55px]">
                  <InputcheckboxComponent
                    value={selectedRows.has(rowIndex)}
                    label=""
                    onChange={() => toggleRow(rowIndex)}
                    name="row"
                    disabled={isRowDisabled && isRowDisabled(row, rowIndex)}
                  />
                </div>
              )}
              <div
                className={` grid hover:bg-gray-100`}
                style={{
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                }}
              >
                {columns?.map((col, colIndex) => (
                  <div key={String(col.field ?? col.header ?? colIndex)}>
                    <div
                      className={`flex items-center font-jakarta text-black text-[16px] pb-[5px] ${cellStyles(
                        col.field!,
                        row[col.field!],
                        row,
                      )} text-s font-medium`}
                    >
                      {col.render
                        ? col.render(row[col.field!], row, rowIndex)
                        : renderCellContent(row[col.field!])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BaseTable;
