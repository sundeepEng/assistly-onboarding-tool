import { NextPage } from "next";
import { useState } from "react";
import BaseTable from "../../../commonComponents/base-table";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import DeleteIcon from "../../../public/icons/delete-icon";
import EditIcon from "../../../public/icons/edit-icon";
import PlusIcon from "../../../public/icons/plus-icon";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import {
  handleCloseAddMedicationModal,
  handleOpenAddMedicationModal,
} from "../../../redux/slices/modal-slice";
import useUpdate from "../../../services/update";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
} from "../../../utils/constants";
import { dateFormat, omit, timeArrayFormat } from "../../../utils/dateUtils";
import AddMedicationFormWrapper from "./add-medication";
import MedicationReviewModal from "./medication-review-modal";
import Loader from "../../../commonComponents/loader";

interface MedicationTypes {
  id: number;
  name: string;
  directions: string;
  startdate: string;
  enddate: string;
  timing: string[];
  additionalComments: string;
}

const Medication: NextPage<{ seniorData: any }> = ({ seniorData }) => {
  const { mutate } = useUpdate();
  // State to store selected medication when editing
  const [selectedMedication, setSelectedMedication] =
    useState<MedicationTypes | null>(null);
  const isAddMedicationModalOpen = useAppSelector(
    (state: { modal: { isAddMedicationModalOpen: boolean } }) =>
      state.modal.isAddMedicationModalOpen,
  );
  const dispatch = useAppDispatch();

  const handleEdit = (medication: MedicationTypes) => {
    setSelectedMedication(medication); // Store selected medication
    dispatch(handleOpenAddMedicationModal()); // Open modal
  };

  const handleDelete = (row) => {
    // TODO: use exception-popover, but need change in component
    //  dispatch(handleOpenPopover());
    //  dispatch(
    //      handleShowPopoverMessage(
    //          "Warning: This action cannot be undone. Do you really want to remove this medication from your list?"
    //      )
    //  );
    const isConfirmed = window.confirm(
      "Warning: This action cannot be undone. Do you really want to remove this medication from your list?",
    );

    if (!isConfirmed) return; // Exit if the user cancels the action
    //TODO: Update to soft delete
    const updatedClinical = {
      ...seniorData.clinical,
      medication: seniorData.clinical.medication.filter(
        (med) => med.id !== row?.id,
      ),
    };

    const cleanedMedicationData: any = omit(
      updatedClinical,
      CLINICAL_USER_PATH_OMIT_FIELDS,
    );

    const payload = {
      data: { ...cleanedMedicationData },
      path: ClinicalUserPath,
    };

    mutate(payload, {
      onSuccess: () => {
        dispatch(handleCloseAddMedicationModal());
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Medication Deleted"));
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            `Error in deleting the medication ${error?.response?.data?.message}!`,
          ),
        );
      },
    });
  };

  const columns = [
    {
      header: "S.No",
      field: "id" as keyof MedicationTypes,
      minWidth: "80px",
      render: (_value, _row, index) => (
        <div className="w-[130px]">{index + 1} .</div>
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Medication",
      field: "name" as keyof MedicationTypes,
      minWidth: "350px",
      render: (_value, row) => (
        <div className="flex flex-col ">
          <p className="font-poppins text-[16px] mb-0">
            {row.name} - {row?.dosage && row?.dosage}
          </p>
          <p className="font-poppins text-[14px] text-[#000000] opacity-70">
            Directions: {row.directions}
          </p>
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Start Date",
      field: "startdate" as keyof MedicationTypes,
      minWidth: "150px",
      render: (_value) => <div>{_value ? dateFormat(_value) : "-"}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "End Date",
      field: "enddate" as keyof MedicationTypes,
      minWidth: "150px",
      render: (_value) => <div>{_value ? dateFormat(_value) : "-"}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Timings",
      field: "timings" as keyof MedicationTypes,
      minWidth: "170px",
      render: (_value: string[]) => (
        <div className="!w-[170px] truncate" title={timeArrayFormat(_value)}>
          {timeArrayFormat(_value)}{" "}
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Comments",
      field: "additionalComments" as keyof MedicationTypes,
      minWidth: "150px",
      render: (_value) => <div>{_value ?? "-"}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Actions",
      field: "actions",
      minWidth: "100px",
      render: (_value, row) => {
        return (
          <div
            className={`flex gap-3 ${seniorData?.isDeleted ? "cursor-not-allowed" : ""}`}
          >
            <button
              className={`w-[36px] h-[36px] rounded-[25px] bg-primary bg-opacity-20 cursor-pointer ${seniorData?.isDeleted ? "pointer-events-none" : ""}`}
              onClick={() => handleEdit(row)}
            >
              <EditIcon />
            </button>
            <button
              className={`w-[36px] h-[36px] rounded-[25px] bg-primary bg-opacity-20 cursor-pointer ${seniorData?.isDeleted ? "pointer-events-none" : ""}`}
              onClick={() => handleDelete(row)}
            >
              <DeleteIcon />
            </button>
          </div>
        );
      },
      headerClassName: "text-xs font-medium ",
    },
  ];

  // Filter out over-the-counter medications only
  const filteredMedication = seniorData?.clinical?.medication?.filter(
    (med) => !med?.overTheCounter,
  );

  if (!seniorData) return <Loader fullScreen={false} spinner={false} />;
  return (
    <div className=" h-full font-jakarta">
      <BaseTable
        columns={columns}
        data={filteredMedication}
        headerStyles="pt-[5px]"
        cellStyles={(field) =>
          field === "id" ? " justify-end h-full" : "flex h-full"
        }
        tableContainerClass={"bg-white"}
      />
      <CommonModal
        title={`${selectedMedication ? "Edit" : "Add"} Medication`}
        modalOpen={isAddMedicationModalOpen}
        setModalOpen={() => {
          dispatch(handleCloseAddMedicationModal());
          setSelectedMedication(null); // Reset selected medication when closing
        }}
        titleClass="text-[24px] font-semibold"
        crossCTA={true}
        width="675px"
        className="py-4"
      >
        <div className="px-[20px]">
          <AddMedicationFormWrapper
            seniorData={seniorData}
            defaultValues={selectedMedication}
          />
        </div>
      </CommonModal>
      {/* <div className="flex justify-center items-center w-full">
        <div className="w-full min-w-[160px]">
      <div className={`flex justify-center items-center w-full ${seniorData?.isDeleted?"cursor-not-allowed opacity-50":""}`}>
        <div className={`w-full min-w-[160px] ${seniorData?.isDeleted?"pointer-events-none":""}`}>
          <Button
            type="button"
            name="Add Medication"
            buttonClick={() => {
              setSelectedMedication(null); // Reset on Add
              dispatch(handleOpenAddMedicationModal());
            }}
            classname="w-full !bg-[white] !border-dashed !border-[#666666] !border-[3px] "
            titleClass="!text-[#666666] py-[10px]"
            icon={<PlusIcon color="#666666" />}
          />
        </div>
      </div> */}
      <MedicationReviewModal seniorData={seniorData} />
    </div>
  );
};
export default Medication;
