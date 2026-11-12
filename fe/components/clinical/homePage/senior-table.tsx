import React from 'react';  // Add this at the top
import { NextPage } from "next";
import { useState } from "react";
import { useDispatch } from "react-redux";
import BaseTable from "../../../commonComponents/base-table";
import Button from "../../../commonComponents/button";
import CircleComponent from "../../../commonComponents/circle-component";
import PopoverComponent from "../../../commonComponents/popover-component";
import SeniorCell from "../../../commonComponents/seniors-table/senior-cell";
import TextareaComponent from "../../../commonComponents/textarea-component";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import useUpdate from "../../../services/update";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
} from "../../../utils/constants";
import { formatDate, omit } from "../../../utils/dateUtils";
import { ExtendedLead } from "../../stage-popup";
import SeniorActions from "../../senior-action-cell";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { getUserRoleFromToken } from "../../../utils/auth";

interface GetLeadsResponse {
  data: Senior[]; // Assuming it returns an array of seniors
  isLoading: boolean;
}

interface Senior {
  userId: string;
  name: string;
  lastName?: string;
  createdAt: string;
  status?: string;
  profileImageUrl?: string;
  initial?: string;
  clinical?: {
    status?: string;
  };
  isDeleted?: boolean;
  medical?: {
    overAllHealth?: {
      alzheimersOrDementia?: string;
    };
  };
  carePlan?: {
    medicationAdministration?: {
      diabeticManagement?: {
        status?: string;
      };
    };
    behaviourPatterns?: {
      wanderingRisk?: string;
      evacuation?: string;
      chokingRisk?: string;
      selfAbusiveBehavior?: string;
      suicidalTendencies?: string;
    };
  };
}

// Define the type for the data prop
interface SeniorsTableProps {
  data: any; // You can specify a more specific type for 'data' if needed
  customEmptyMessage?: string;
}

const SeniorsTable: NextPage<SeniorsTableProps> = ({
  data,
  customEmptyMessage,
}) => {
  const role = getUserRoleFromToken();
  const accessDeletedSeniors = hasAccess(
    role as Role,
    "VIEW_DELETED_SENIORS",
    "EDIT",
  );

  // Filter data based on access: show all seniors if has access, otherwise show only non-deleted
  const filteredData = accessDeletedSeniors
    ? data // Show all seniors (both deleted and active)
    : data?.filter((senior: Senior) => !senior?.isDeleted); // Show only non-deleted seniors
  const columns = [
    {
      header: "Seniors",
      field: "name" as keyof Senior,
      render: (_value: string, data: Senior) => <SeniorCell data={data} />,
      minWidth: "250px",
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Added",
      field: "createdAt" as keyof Senior,
      render: (value: string) => <p>{formatDate(value)}</p>,
      headerClassName: "pl-[10px] text-xs font-medium",
    },
    {
      header: "Vital Signs",
      field: "vitalSigns" as keyof Senior,
      render: (_value: string, data: Senior) => (
        <div className="flex gap-1">
          <CircleComponent data={data} alignHorizontal={true} />
        </div>
      ),
      headerClassName: "pl-[10px] text-xs font-medium",
      minWidth: "200px",
    },
    {
      header: "Status",
      field: "Status" as keyof Senior,
      headerClassName: "pl-[5px] text-xs font-medium",
      minWidth: "290px",
      render: (value: string, data: Senior) => {
        const [open, setIsOpen] = useState(false);
        const [status, setStatus] = useState(data?.clinical?.status || "");
        const { mutate } = useUpdate();
        const dispatch = useDispatch();

        const handleChangeStatus = () => {
          const updatedData = {
            ...data?.clinical,
            status: status,
          };
          const cleanedSeniorData = omit(
            updatedData,
            CLINICAL_USER_PATH_OMIT_FIELDS,
          );
          const payload = {
            data: cleanedSeniorData as unknown as ExtendedLead,
            path: ClinicalUserPath,
          };
          mutate(payload, {
            onSuccess: () => {
              dispatch(handleOpenPopover());
              dispatch(handleShowPopoverMessage(` Status Changed!`));
            },
            onError: (error: any) => {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  `${
                    error?.response?.data?.error[0]?.message ||
                    "change of  status failed"
                  } `,
                ),
              );
            },
          });
        };
        return (
          <div className={`${data?.isDeleted && "pointer-events-none"}`}>
            <PopoverComponent
              isOpen={open}
              body={
                <div>
                  <TextareaComponent
                    label="Change Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    name="refuse comment"
                  />
                  <div className="flex justify-center align-center pt-[20px]">
                    <Button
                      name="Save"
                      buttonClick={() => {
                        handleChangeStatus();
                        setIsOpen(false);
                      }}
                    />
                  </div>
                </div>
              }
              setIsOpen={setIsOpen}
            >
              <div
                className={`bg-primary/20 text-primary font-medium text-lg px-4 py-2 rounded-lg cursor-pointer ${
                  //    TODO: need to update this to constants
                  data?.clinical?.status?.toLowerCase()?.includes("house") ||
                  data?.clinical?.status?.toLowerCase()?.includes("home")
                    ? "!bg-primary/20 !text-primary"
                    : "!bg-white bg-opacity-10 text-primary border border-solid border-primary"
                }`}
              >
                {data?.clinical?.status
                  ? data?.clinical?.status
                  : "Not Provided"}
              </div>
            </PopoverComponent>
          </div>
        );
      },
    },
    {
      header: "",
      field: "actions" as keyof Senior,
      headerClassName: "flex justify-end",
      minWidth: "50px",
      render: (_value: string, row: Senior) => (
        <SeniorActions
          data={row}
          userId={row.userId}
          className={`${row?.isDeleted && "pointer-events-none "}`}
        />
      ),
    },
  ];

  return (
      <div className="pb-8 h-full">
        {filteredData?.length > 0 ? (
          <BaseTable
            columns={columns}
            data={filteredData}
            headerStyles="pt-[5px]"
            rowStyles={(row) =>
              `${accessDeletedSeniors && row?.isDeleted ? "bg-[#bcb9b9] opacity-50" : ""}`
            }
            cellStyles={(field) =>
              (field as unknown) === "actions" ? "flex justify-end items-end pr-[10px] h-full" : "h-full"
            }
            tableContainerClass={"rounded-[7px] bg-white"}
          />
        ) : (
          <p className="text-gray-500 text-lg font-medium font-jakarta">
            No Personal Care Givers added yet.
          </p>
        )}
      </div>
  );
};

export default SeniorsTable;