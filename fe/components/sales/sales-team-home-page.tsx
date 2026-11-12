import React, { useContext, useEffect, useState } from "react";
import BaseTable from "../../commonComponents/base-table";
import SalesTeamCell from "./sales-team-cell";
import SalesTeamActionCell from "./sales-team-action-cell";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { getUserRoleFromToken } from "../../utils/auth";

// Interface for a Sales Team Member
export interface SalesTeamMember {
  userId: string;
  name: string;
  profileImageUrl?: string;
  email: string;
  mobile: string;
  role: string;
  actions?: string;
}

/**
 * SalesTeamHomePage - Displays the sales team table with BaseTable
 * Follows the same pattern as PCGHomePage
 * Columns: Name, Email, Phone, Role, Actions (Onboard)
 */
const SalesTeamHomePage = ({ data }) => {
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  // Check if user has access to sales team
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "HCM_SALES_TEAM", "EDIT"));
  }, [role]);

  // Define table columns - Name, Email, Phone, Role, Actions
  const columns = [
    {
      header: "Name",
      field: "name" as keyof SalesTeamMember,
      render: (_value: string, row: SalesTeamMember) => (
        <SalesTeamCell name={row?.name} data={row} />
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
      minWidth: "200px",
    },
    {
      header: "Email",
      field: "email" as keyof SalesTeamMember,
      render: (value) => (
        <p
          className="m-0 truncate max-w-[300px] overflow-hidden whitespace-nowrap text-ellipsis"
          title={value}
        >
          {value?.length > 30
            ? value?.substring(0, 30) + "..."
            : value
            ? value
            : "-"}
        </p>
      ),
      minWidth: "300px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Phone",
      field: "mobile" as keyof SalesTeamMember,
      render: (value) => <div>{value || "-"}</div>,
      minWidth: "180px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Role",
      field: "role" as keyof SalesTeamMember,
      render: (value) => (
        <div className="flex items-center">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {value === "SalesDirector" ? "Sales Director" : "Sales Representative"}
          </span>
        </div>
      ),
      minWidth: "150px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "",
      field: "actions" as keyof SalesTeamMember,
      render: (_value: string, row: SalesTeamMember) => (
        <SalesTeamActionCell row={row} />
      ),
      minWidth: "50px",
      headerClassName: "flex justify-end",
    },
  ];

  return (
    <div className="">
      <div className="flex justify-between"></div>
      <div className="py-[25px]">
          <BaseTable
            columns={columns}
            data={data}
            headerStyles="pt-[5px]"
            rowStyles={(row) => "h-[54px]"}
            cellStyles={(field) =>
              field === "actions"
                ? "flex justify-end items-end pr-[10px] h-full"
                : "h-full"
            }
            tableContainerClass={"rounded-[7px] bg-white"}
          />
      </div>
    </div>
  );
};

export default SalesTeamHomePage;
