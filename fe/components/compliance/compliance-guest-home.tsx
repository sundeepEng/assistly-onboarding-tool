import React from "react";
import BaseTable from "../../commonComponents/base-table";
import ComplianceGuestActionsCell from "./compliance-guest-actions-cell";
import ComplianceGuestCell from "./compliance-guest-cell";

const ComplianceGuestHome = ({ data }) => {
  const columns = [
    {
      header: "Name",
      field: "name",
      render: (_value: string, row) => (
      <ComplianceGuestCell row={row}/>
      ),
      minWidth: "300px",
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Email",
      field: "email",
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
      minWidth: "400px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Phone",
      field: "mobile",
      render: (value) => <div>{value || "-"}</div>,
      minWidth: "200px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "",

      field: "actions" ,
      render: (_value: string, row) => <ComplianceGuestActionsCell row={row} />,
      minWidth: "200px",
      headerClassName:"flex justify-end pr-[10px]"
    },
    
  ];
  return (
    <div className="">
      {data?.users?.length > 0 ? (
        <BaseTable
          columns={columns}
          data={data?.users}
          headerStyles="pl-[5px]"
          rowStyles={() =>
            "h-[54px]"
          }
          cellStyles={(field)=>(field==="actions"?"flex justify-end items-end pr-[10px] h-full":"h-full")}
        tableContainerClass={"rounded-[7px] bg-white"}
        />
      ) : (
        <p className="text-gray-500 text-lg font-medium font-poppins">
          No Compliance Guests added yet.
        </p>
      )}
    </div>
  );
};

export default ComplianceGuestHome;
