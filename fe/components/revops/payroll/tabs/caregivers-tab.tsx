"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import BaseTable from "../../../../commonComponents/base-table";
import PopoverComponent from "../../../../commonComponents/popover-component";
import MenuIcon from "../../../../public/icons/menu-icon";
import { Clock, Eye, Pencil } from "lucide-react";
import { formatCurrency } from "../payroll-utils";
import { dateFormat } from "../../../../utils/dateUtils";
import Loader from "../../../../commonComponents/loader";

function StaffActionsCell({
  row,
  onViewDetails,
}: {
  row: any;
  onViewDetails: (row: any) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    if (row?.userId) {
      router.push(`/hcm/team/${row.userId}`);
    }
  };

  const handleLogHours = () => {
    setIsMenuOpen(false);
    router.push('/hcm');
  };

  return (
    <div className="w-full flex items-center gap-3">
      {/* <button type="button" className="p-1" onClick={() => onViewDetails(row)}>
        <EyeIcon />
      </button>
      <button type="button" className="p-1" onClick={() => {}}>
        <Clock size={16} color="#111827" />
      </button> */}
      <PopoverComponent
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        body={
          <div className="w-[180px] font-poppins">
            {/* TODO: Right now it is not required, so hiding it */}
            {/* <div
              className="flex items-center gap-2 p-[8px] cursor-pointer hover:bg-lightgray hover:rounded-md"
              onClick={() => {
                setIsMenuOpen(false);
                onViewDetails(row);
              }}
            >
              <Eye size={16} className="text-[#111827]" />
              <div className="text-sm text-[#111827]">View Details</div>
            </div> */}
            <div
              className="flex items-center gap-2 p-[8px] cursor-pointer hover:bg-lightgray hover:rounded-md"
              onClick={handleLogHours}
            >
              <Clock size={16} className="text-[#111827]" />
              <div className="text-sm text-[#111827]">Log Hours</div>
            </div>
            <div
              className="flex items-center gap-2 p-[8px] cursor-pointer hover:bg-lightgray hover:rounded-md"
              onClick={handleEditProfile}
            >
              <Pencil size={16} className="text-[#111827]" />
              <div className="text-sm text-[#111827]">Edit Profile</div>
            </div>
            <div className="h-[1px] bg-[#E5E7EB] my-1" />
            {/* <div
              className="flex items-center gap-2 p-[8px] cursor-pointer hover:bg-lightgray hover:rounded-md"
              onClick={() => setIsMenuOpen(false)}
            >
              <UserMinus size={16} className="text-red-600" />
              <div className="text-sm text-red-600">Deactivate</div>
            </div> */}
          </div>
        }
      >
        <MenuIcon />
      </PopoverComponent>
    </div>
  );
}

export default function RevopsPayrollCaregiversTab({
  staff,
  onViewDetails,
  isLoading,
}: {
  staff: any[];
  onViewDetails: (row: any) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <Loader />;
  }
  const staffColumns = [
    // { header: "Employee ID", field: "employeeId" as const, minWidth: "120px" },
    { header: "Name", field: "name" as const, minWidth: "300px", render: (value: string) => <span className="truncate block max-w-[160px]" title={value}>{value}</span> },
    { header: "Role", field: "role" as const, minWidth: "200px", render: (value: string) => value === "PCG" ? "Caregiver" : value },
    {
      header: "Wage",
      field: "roaster" as const,
      minWidth: "200px",
      headerClassName: "",
      render: (value: any[]) => (
        <div className="w-full">
          {formatCurrency(Number(value?.[0]?.pay_rate ?? 0))}
          {value?.[0]?.pay_frequency === "Monthly" ? "/month" : "/hour"}
        </div>
      ),
    },
    {
      header: "Hire Date",
      field: "createdAt" as const,
      minWidth: "200px",
      headerClassName: "",
      render: (value: string) => (
        <div className="w-full">{value ? dateFormat(value.slice(0, 10)) : "-"}</div>
      ),
    },
    // {
    //   header: "Status",
    //   field: "isDeleted" as const,
    //   minWidth: "80px",
    //   headerClassName: "",
    //   render: () => (
    //     <div className="w-full flex">
    //       <StaffStatusPill status="active" />
    //     </div>
    //   ),
    // },
    {
      header: "Actions",
      field: "userId" as const,
      minWidth: "200px",
      headerClassName: "flex justify-end pr-[50px]",
      render: (_value: string, row: any) => (
        <div className="pr-[50px]"><StaffActionsCell row={row} onViewDetails={onViewDetails} /></div>
      ),
    },
  ];

  return (
    <div>
      <BaseTable
        columns={staffColumns}
        data={staff}
        headerStyles="p-2 pl-10 text-base"
        rowStyles={() =>
          "border-b-[1px] border-solid border-[#818183] px-2 py-2 pl-10 text-base"}
         cellStyles={(field) =>
              field === "userId" ? "!flex !justify-end items-end pr-[50px] h-full" : "h-full"
            }
          tableContainerClass={" bg-white"}
      />
    </div>
  );
}
