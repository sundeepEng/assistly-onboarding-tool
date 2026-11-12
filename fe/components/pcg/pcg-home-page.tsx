import React, { useContext, useEffect, useState } from "react";
import BaseTable from "../../commonComponents/base-table";
import PCGCell from "./pcg-cell";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { useRouter } from "next/router";
import PCGActionsCell from "../pcg-action-cell";
import PCGContractStatus from "./pcg-contract-status";
import { getUserRoleFromToken } from "../../utils/auth";

export interface PCG {
  userId: string;
  name: string;
  profileImageUrl?: string;
  email: string;
  mobile: string;
  role: string;
  isDeleted?: boolean;
}

const PCGHomePage = ({ data }) => {
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_PCG", "EDIT"));
  }, [role]);

  const router = useRouter();
  const isCRM = router.pathname.startsWith("/crm");

  const columns = [
    {
      header: "Name",
      field: "name" as keyof PCG,
      render: (_value: string, row: PCG) => (
        <PCGCell name={row?.name} data={row} />
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
      minWidth: "250px",
    },
    {
      header: "Email",
      field: "email" as keyof PCG,
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
      field: "mobile" as keyof PCG,
      render: (value) => <div>{value || "-"}</div>,
      minWidth: "200px",
      headerClassName: "text-xs font-medium",
    },
    isCRM
      ? {
          header: "Contract Status",
          render: (_value, row) => <PCGContractStatus data={row} />,
          minWidth: "200px",
          headerClassName: "text-xs font-medium",
        }
      : null,
    {
      header: "",

      field: "actions" as keyof PCG,
      render: (_value: string, row: PCG) => (
        <PCGActionsCell
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
              ` h-[54px]  ${
                row?.isDeleted && "bg-[#bcb9b9] opacity-50"
              }`
            }
            cellStyles={(field) =>
              field === "actions" ? "flex justify-end items-end pr-[10px] h-full" : "h-full"
            }
            tableContainerClass={"rounded-[7px] bg-white"}
          />
        ) : (
          <p className="text-gray-500 text-lg font-medium font-jakarta">
            No Personal Care Givers added yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default PCGHomePage;