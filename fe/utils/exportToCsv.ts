export interface ExportColumn {
  header: string;
  field: string;
}

export const exportToCsv = (
  rows: any[],
  columns: ExportColumn[],
  filename: string = "export.csv"
) => {
  if (!rows || rows.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Create header row
  const headers = columns.map((col) => col.header);
  
  // Create data rows
  const dataRows = rows.map((row, index) => {
    return columns.map((col) => {
      // Handle S.No separately (1-based index)
      if (col.field === "sno") {
        return index + 1;
      }
      // Get value from row data
      const value = row[col.field];
      // Handle null/undefined
      if (value === null || value === undefined) {
        return "";
      }
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
  });

  // Combine header and data rows
  const csvContent = [headers, ...dataRows]
    .map((row) => row.join(","))
    .join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};
