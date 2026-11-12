import { NextPage } from "next";
import { useContext, useState } from "react";
import BaseTable from "../../../commonComponents/base-table";
import DeleteIcon from "../../../public/icons/delete-icon";
import EditIcon from "../../../public/icons/edit-icon";
import { DeleteConfirmationModal } from "../../documents/document-card-ui";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  handleCloseAddIncidentModal,
  handleOpenAddIncidentModal,
} from "../../../redux/slices/modal-slice";
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
import {
  formatIsoToDate,
  formatIsoToLocalTime,
  omit,
} from "../../../utils/dateUtils";
import IncidentReportedBy from "../../reported-by-cell";
import IncidentReportFormWrapper from "./incident-report-form";
import CommonModal from "../../../commonComponents/common-modal";
import { IncidentPDF } from "./download-incident";
import { RoleContext } from "../../role-provider";
import { getUserRoleFromToken } from "../../../utils/auth";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";

interface Incident {
  id: string;
  reportedBy: string;
  reporterName: string;
  incidentStartTime: string;
  incidentEndTime: string;
  reportedDate: string;
  incidentDescription: string;
  comments?: string;
  incidentDate: string;
  incidentReportedAt: string;
  detailsOfIncident: string;
  incidentId?: string;
}

const IncidentReport: NextPage<{ seniorData: any }> = ({ seniorData }) => {
  const dispatch = useAppDispatch();
  const { mutate } = useUpdate();
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [incidentToDelete, setIncidentToDelete] = useState<any | null>(null);

  const contextRole = useContext(RoleContext)?.role;
  const role = contextRole || getUserRoleFromToken();
  const canEditIncidents = hasAccess(
    role as Role,
    "CLINICAL_INCIDENT",
    "EDIT",
  );

  const handleEdit = (incident: any) => {
    setSelectedIncident(incident);
    dispatch(handleOpenAddIncidentModal());
  };

  const handleDeleteClick = (incident: any) => {
    if (seniorData?.isDeleted) return;
    setIncidentToDelete(incident);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    const incidentId = incidentToDelete?.incidentId;
    if (!incidentId) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Unable to delete incident report"));
      setDeleteModalOpen(false);
      setIncidentToDelete(null);
      return;
    }

    const updatedClinical = {
      ...(seniorData?.clinical || {}),
      incidentReport: (Array.isArray(seniorData?.clinical?.incidentReport)
        ? seniorData.clinical.incidentReport
        : []
      ).filter((r: any) => r?.incidentId !== incidentId),
    };

    const cleanedClinicalData: any = omit(
      updatedClinical,
      CLINICAL_USER_PATH_OMIT_FIELDS,
    );
    const payload = {
      data: { ...cleanedClinicalData },
      path: ClinicalUserPath,
    };

    try {
      setDeleteLoading(true);
      mutate(payload, {
        onSuccess: () => {
          dispatch(handleCloseAddIncidentModal());
          setSelectedIncident(null);
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Incident report deleted"));
          setDeleteModalOpen(false);
          setIncidentToDelete(null);
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              error?.response?.data?.message ||
                "Error deleting incident report",
            ),
          );
        },
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteLoading(false);
    setIncidentToDelete(null);
  };

  const historyColumns = [
    {
      header: "S.No",
      minWidth: "50px",
      render: (_value, _data, index) => {
        return <div className="pl-[25px]">{index + 1}.</div>;
      },
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Description",
      field: "incidentDetails" as keyof Incident,
      minWidth: "300px",
      render: (value) => (
        <div className="w-[220px]">
          <p className="truncate ">{value}</p>
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Date",
      field: "incidentDate" as keyof Incident,
      minWidth: "100px",
      render: (value) => (
        <div className="px-[10px]">{formatIsoToDate(value)}</div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Time",
      minWidth: "100px",
      field: "incidentDate" as keyof Incident,
      render: (value, row: Incident) => (
        <div className="px-[10px]">{formatIsoToLocalTime(value)}</div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "PDF",
      field: "comments" as keyof Incident,
      minWidth: "50px",
      render: (value, data) => (
        <div className="w-[220px]">
          <IncidentPDF incidentDetails={data} />
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Reported By",
      minWidth: "200px",
      render: (_value, row: Incident) => (
        <IncidentReportedBy
          reporterName={row?.reporterName}
          reportedDate={row.incidentReportedAt}
        />
      ),
      headerClassName: "text-xs font-medium",
    },
    ...(canEditIncidents
      ? [
          {
            header: "Actions",
            field: "actions",
            minWidth: "100px",
            render: (_value, row: any) => (
              <div
                className={`flex gap-3 ${seniorData?.isDeleted ? "cursor-not-allowed" : ""}`}
              >
                <button
                  className={`w-[36px] h-[36px] rounded-[25px] bg-primary bg-opacity-20 cursor-pointer ${
                    seniorData?.isDeleted ? "pointer-events-none" : ""
                  }`}
                  onClick={() => handleEdit(row)}
                >
                  <EditIcon />
                </button>
                <button
                  className={`w-[36px] h-[36px] rounded-[25px] bg-primary bg-opacity-20 cursor-pointer ${
                    seniorData?.isDeleted ? "pointer-events-none" : ""
                  }`}
                  onClick={() => handleDeleteClick(row)}
                >
                  <DeleteIcon />
                </button>
              </div>
            ),
            headerClassName: "text-xs font-medium ",
          },
        ]
      : []),
  ];

  const isAddIncidentModalOpen = useAppSelector(
    (state: { modal: { isAddIncidentModalOpen: boolean } }) =>
      state.modal.isAddIncidentModalOpen,
  );

  return (
    <div
      className={`bg-[#FAFAFA]h-full ${seniorData?.isDeleted ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div>
        <BaseTable
          columns={historyColumns}
          data={seniorData?.clinical?.incidentReport || []}
          headerStyles="pt-[5px]"
          cellStyles={(field) =>
            field === "id" ? " justify-end h-full" : "flex h-full"
          }
          tableContainerClass="!w-full bg-white"
        />
      </div>
      {/* <StateIncidentPage /> */}
      <CommonModal
        modalOpen={isAddIncidentModalOpen}
        setModalOpen={() => {
          dispatch(handleCloseAddIncidentModal());
          setSelectedIncident(null);
        }}
        title={
          selectedIncident ? "Edit Incident Report" : "Add Incident Report"
        }
        crossCTA={true}
      >
        <IncidentReportFormWrapper
          userData={seniorData}
          setModalOpen={() => {
            dispatch(handleCloseAddIncidentModal());
            setSelectedIncident(null);
          }}
          defaultIncident={selectedIncident}
        />
      </CommonModal>

      <DeleteConfirmationModal
        open={deleteModalOpen}
        setOpen={setDeleteModalOpen}
        documentName={"this incident report"}
        isLoading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Delete Incident Report"
      />
    </div>
  );
};

export default IncidentReport;
