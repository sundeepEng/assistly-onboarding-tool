import React, { useContext, useEffect, useState } from "react";
import BaseTable from "../../commonComponents/base-table";
import NurseCell from "./nurse-cell";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { useRouter } from "next/router";
import NurseActionsCell from "../nurse-action-cell";
import NurseContractStatus from "./nurse-contract-status";
import { getUserRoleFromToken } from "../../utils/auth";

export interface NurseRow {
  userId: string;
  name: string;
  profileImageUrl?: string;
  email: string;
  mobile: string;
  role: string;
  isDeleted?: boolean;
}

// Nurse Leads/Nurses table UI. This mirrors the PCG table so we can reuse the same user experience.
const NurseHomePage = ({ data }) => {
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  // Computes whether the current user can use the Nurse table actions.
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_NURSE", "EDIT"));
  }, [role]);

  const router = useRouter();
  const isCRM = router.pathname.startsWith("/crm");

  const columns = [
    {
      header: "Name",
      field: "name" as keyof NurseRow,
      render: (_value: string, row: NurseRow) => (
        <NurseCell name={row?.name} data={row} />
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
      minWidth: "250px",
    },
    {
      header: "Email",
      field: "email" as keyof NurseRow,
      render: (value) => (
        <p
          className="m-0 truncate max-w-[380px] overflow-hidden whitespace-nowrap text-ellipsis"
          title={value}
        >
          {value?.length > 38
            ? value?.substring(0, 38) + "..."
            : value
              ? value
              : "-"}
        </p>
      ),
      minWidth: "380px",
      headerClassName: " text-xs font-medium",
    },
    {
      header: "Phone",
      field: "mobile" as keyof NurseRow,
      render: (value) => <div>{value || "-"}</div>,
      minWidth: "200px",
      headerClassName: "text-xs font-medium",
    },
    isCRM
      ? {
          header: "Contract Status",
          render: (_value, row) => <NurseContractStatus data={row} />,
          minWidth: "200px",
          headerClassName: "text-xs font-medium",
        }
      : null,
    {
      header: "",
      field: "actions" as keyof NurseRow,
      render: (_value: string, row: NurseRow) => (
        <NurseActionsCell
          row={row}
          classname={`${row?.isDeleted && "pointer-events-none "}`}
        />
      ),
      minWidth: "50px",
      headerClassName: "flex justify-end",
    },
  ].filter(Boolean);

  return (
    <div className="">
      <div className="flex justify-between"></div>
      <div className="py-[25px]">
        {data?.length > 0 ? (
          <BaseTable
            columns={columns}
            data={data}
            headerStyles="pt-[5px]"
            rowStyles={(row) =>
              ` h-[54px]  ${row?.isDeleted && "bg-[#bcb9b9] opacity-50"}`
            }
            cellStyles={(field) =>
              field === "actions"
                ? "flex justify-end items-end pr-[10px] h-full"
                : "h-full"
            }
            tableContainerClass={"rounded-[7px] bg-white"}
          />
        ) : (
          <p className="text-gray-500 text-lg font-medium font-jakarta">
            No Nurse Leads added yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default NurseHomePage;