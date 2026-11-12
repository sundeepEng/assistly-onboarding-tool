import React from "react";
import BaseTable from "../../../commonComponents/base-table";
import Avatar from "../../../commonComponents/avatar";

export interface PerRepMetric {
  name: string;
  initial: number;
  tour: number;
  signed: number;
  boarded: number;
  lost: number;
  newLeads7: number;
  newLeads30: number;
  conversionPercentage: number; // percentage value, e.g. 23
  averageAge: { value: number; unit: string }; // in days
}

interface PerRepMetricsTableProps {
  data: PerRepMetric[];
}

// const getConvBadge = (conv: number) => {
//   if (conv >= 20) return "bg-green-100 text-green-700";
//   if (conv >= 10) return "bg-amber-100 text-amber-700";
//   return "bg-red-100 text-red-700";
// };

const PerRepMetricsTable: React.FC<PerRepMetricsTableProps> = ({
  data,
}) => {
  const columns = [
    {
      header: "Rep",
      field: "name" as keyof PerRepMetric,
      render: (_v: string, row: PerRepMetric) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size={36} />
          <span className="text-sm font-medium text-black">{row.name}</span>
        </div>
      ),
      minWidth: "220px",
      headerClassName: "pl-2 text-xs font-medium text-gray-600",
    },
    {
      header: "Initial Contact",
      field: "initial" as keyof PerRepMetric,
      render: (v: number) => <span className="text-sm">{v}</span>,
      minWidth: "80px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    {
      header: "Home Tour",
      field: "tour" as keyof PerRepMetric,
      render: (v: number) => <span className="text-sm">{v}</span>,
      minWidth: "80px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    {
      header: "Contract Signed",
      field: "signed" as keyof PerRepMetric,
      render: (v: number) => <span className="text-sm">{v}</span>,
      minWidth: "80px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    // {
    //   header: "Onboarded",
    //   field: "boarded" as keyof PerRepMetric,
    //   render: (v: number) => (
    //     <span className="text-sm font-medium">{v}</span>
    //   ),
    //   minWidth: "90px",
    //   headerClassName: "text-xs font-medium text-gray-600",
    // },
    {
      header: "Lost",
      field: "lost" as keyof PerRepMetric,
      render: (v: number) => (
        <span className="text-sm font-medium">{v}</span>
      ),
      minWidth: "80px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    {
      header: "New 7d",
      field: "newLeads7" as keyof PerRepMetric,
      render: (v: number) => <span className="text-sm">{v}</span>,
      minWidth: "90px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    {
      header: "New 30d",
      field: "newLeads30" as keyof PerRepMetric,
      render: (v: number) => <span className="text-sm">{v}</span>,
      minWidth: "90px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    {
      header: "Conv%",
      field: "conversionPercentage" as keyof PerRepMetric,
      render: (v: number) => <span className="text-sm">{v}%</span>,
      minWidth: "90px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
    {
      header: "Avg Age",
      field: "averageAge" as keyof PerRepMetric,
      render: (v: { value: number; unit: string }) => (
        <span className="text-sm text-gray-400">{v?.value}{" "}{v?.unit}</span>
      ),
      minWidth: "90px",
      headerClassName: "text-xs font-medium text-gray-600",
    },
  ];

  return (
    <div className="bg-white p-4 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold font-jakarta">Per-Rep Metrics</h2>

      </div>
      <BaseTable
        columns={columns}
        data={data}
        headerStyles="pt-[5px]"
        rowStyles={() => "h-[56px]"}
        cellStyles={() => "h-full"}
        tableContainerClass="rounded-[7px]"
      />
    </div>
  );
};

export default PerRepMetricsTable;
