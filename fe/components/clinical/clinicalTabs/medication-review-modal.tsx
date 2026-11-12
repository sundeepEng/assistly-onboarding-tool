import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import CommonModal from "../../../commonComponents/common-modal";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  clearExtractedMedications,
  markDocumentExtracted,
  removeExtractedMedication,
  updateExtractedMedication,
  ExtractedMedication,
} from "../../../redux/slices/medication-extraction-slice";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import useUpdate from "../../../services/update";
import { useQueryClient } from "@tanstack/react-query";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
  UserPath,
  userRoles,
} from "../../../utils/constants";
import { dateFormat, omit, timeArrayFormat } from "../../../utils/dateUtils";
import { timeOptions24H } from "../../../utils/dateUtils";
import BaseTable from "../../../commonComponents/base-table";
import { ClinicalSchema } from "../../../model/clinical/clinical.model";
import { AddMedicationForm } from "./add-medication";
import DeleteIcon from "../../../public/icons/delete-icon";
import EditIcon from "../../../public/icons/edit-icon";
import { TriangleAlert } from "lucide-react";

interface MedicationReviewModalProps {
  seniorData: any;
}

const MedicationReviewModal: React.FC<MedicationReviewModalProps> = ({
  seniorData,
}) => {
  const dispatch = useAppDispatch();
  const { mutate, isPending } = useUpdate();
  const queryClient = useQueryClient();
  const { extractedMedications } = useAppSelector(
    (state: { medicationExtraction: { extractedMedications: ExtractedMedication[] } }) =>
      state.medicationExtraction
  );

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const isOpen = extractedMedications.length > 0;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    dispatch(clearExtractedMedications());
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingIndex(null);
  };

  const handleEditSubmit = (data: any) => {
    if (editingIndex !== null) {
      const formData = data.medication;
      const updatedMed: ExtractedMedication = {
        ...extractedMedications[editingIndex],
        name: formData.name || "",
        dosage: formData.dosage || "",
        directions: formData.directions || "",
        startdate: formData.startdate || "",
        enddate: formData.enddate || "",
        timings: formData.timings || [],
        additionalComments: formData.additionalComments || "",
      };
      dispatch(
        updateExtractedMedication({ index: editingIndex, medication: updatedMed })
      );
      handleCloseEditModal();
    }
  };


  const handleRemove = (index: number) => {
    dispatch(removeExtractedMedication(index));
    if (editingIndex === index) {
      handleCloseEditModal();
    }
  };

  const handleApproveAll = () => {
    if (!seniorData) return;
    if (isPending) return; // guard against double-submit

    const today = format(new Date(), "yyyy-MM-dd");

    const normalizeTime = (t: string): string | null => {
      if (!t) return null;
      // Already HH:mm:ss
      if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
      // HH:mm → HH:mm:ss
      const match = t?.match?.(/^(\d{1,2}):(\d{2})$/);
      if (match) return `${match[1].padStart(2, "0")}:${match[2]}:00`;
      if (t?.toLowerCase?.()?.trim?.() === "prn") return "07:00:00";
      // Invalid (PRN, text, etc.)
      return null;
    };

    const cleanMedication = (med: any) => {
      const validTimings = Array.isArray(med.timings)
        ? med.timings.map(normalizeTime).filter((t: string | null): t is string => t !== null)
        : [];

      const entry: any = {
        id: med.id || uuidv4(),
        name: med.name || "",
        dosage: med.dosage || "",
        directions: med.directions || "",
        startdate: med.startdate || today,
        timings: validTimings.length > 0 ? validTimings : ["08:00:00"],
        overTheCounter: med.overTheCounter ?? false,
        additionalComments: med.additionalComments || "",
      };
      if (med.enddate) {
        entry.enddate = med.enddate;
      }
      return entry;
    };

    const newMedications = extractedMedications.map((med) => cleanMedication(med));

    const existingMedications = Array.isArray(seniorData?.clinical?.medication)
      ? seniorData.clinical.medication.map(cleanMedication)
      : [];

    // New medications override existing ones with the same name
    const newMedNames = new Set(newMedications.map((m: any) => m.name.toLowerCase()));
    const filteredExisting = existingMedications.filter(
      (med: any) => !newMedNames.has(med.name.toLowerCase())
    );

    // Deduplicate by id as safety net
    const seen = new Set<string>();
    const allMedications = [...filteredExisting, ...newMedications].filter((med) => {
      if (seen.has(med.id)) return false;
      seen.add(med.id);
      return true;
    });

    const clinicalData = seniorData?.clinical || {};
    const payloadData = {
      ...clinicalData,
      medication: allMedications,
      userId: seniorData?.userId,
    };

    const cleanedMedicationData: any = omit(
      payloadData,
      CLINICAL_USER_PATH_OMIT_FIELDS
    );

    const payload = {
      data: { ...cleanedMedicationData },
      path: ClinicalUserPath,
    };

    mutate(payload, {
      onSuccess: async () => {
        // The shared useUpdate hook already invalidates [SENIOR], which
        // triggers a background refetch of the senior query. That refetch
        // can race with our write — on BE eventual-consistency it may
        // return the pre-write clinical data and overwrite our update,
        // forcing the user to refresh manually.
        //
        // To avoid that race we:
        //   1. Cancel any in-flight refetch of the senior query.
        //   2. Optimistically write the new medication list into the cache
        //      so the Medication table reflects the change immediately.
        const seniorQueryKey = [
          userRoles.SENIOR,
          seniorData?.userId,
          UserPath,
        ];
        await queryClient.cancelQueries({ queryKey: seniorQueryKey });
        queryClient.setQueryData(seniorQueryKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            clinical: {
              ...(old.clinical || {}),
              medication: allMedications,
            },
          };
        });
        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            `${newMedications.length} medication(s) added successfully`
          )
        );
        dispatch(markDocumentExtracted());
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            error?.response?.data?.error?.[0]?.message || error?.response?.data?.message || "Error adding medications"
          )
        );
      },
    });
  };

  const editingMedication = editingIndex !== null ? extractedMedications[editingIndex] : null;

  const reviewColumns = [
    {
      header: "S.No",
      field: "id" as keyof ExtractedMedication,
      minWidth: "60px",
      render: (_value: any, _row: any, index: number) => (
        <div className="w-[60px]">{index + 1} .</div>
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Medication",
      field: "name" as keyof ExtractedMedication,
      minWidth: "250px",
      render: (_value: any, row: ExtractedMedication) => (
        <div className="flex flex-col">
          <p className="font-poppins text-[16px] mb-0">
            {row.name} {row.dosage && `- ${row.dosage}`}
          </p>
          <p className="font-poppins text-[14px] text-[#000000] opacity-70">
            Directions: {row.directions || "-"}
          </p>
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Start Date",
      field: "startdate" as keyof ExtractedMedication,
      minWidth: "120px",
      render: (_value: any) => <div>{_value ? dateFormat(_value) : "-"}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "End Date",
      field: "enddate" as keyof ExtractedMedication,
      minWidth: "120px",
      render: (_value: any) => <div>{_value ? dateFormat(_value) : "-"}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Timings",
      field: "timings" as keyof ExtractedMedication,
      minWidth: "170px",
      render: (_value: string[]) => (
        <div className="!w-[170px] truncate" title={timeArrayFormat(_value)}>
          {timeArrayFormat(_value)}
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Comments",
      field: "additionalComments" as keyof ExtractedMedication,
      minWidth: "120px",
      render: (_value: any) => <div>{_value ?? "-"}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Actions",
      field: "actions" as any,
      minWidth: "100px",
      render: (_value: any, _row: ExtractedMedication, index: number) => (
        <div className="flex gap-3">
          <button
            className="w-[36px] h-[36px] rounded-[25px] bg-primary bg-opacity-20 cursor-pointer"
            onClick={() => handleStartEdit(index)}
          >
            <EditIcon />
          </button>
          <button
            className="w-[36px] h-[36px] rounded-[25px] bg-red-100 cursor-pointer"
            onClick={() => handleRemove(index)}
          >
            <DeleteIcon />
          </button>
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
  ];

  if (!isOpen) return null;

  return (
    <CommonModal
      title="Review Extracted Medications"
      modalOpen={isOpen}
      setModalOpen={handleClose}
      titleClass="text-[24px] font-semibold"
      crossCTA={true}
      width="1100px"
      className="py-4"
    >
      <div className="px-[20px] font-poppins">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <TriangleAlert size={16} className="text-amber-500 mt-0.5" />
          <p className="text-sm text-amber-800 m-0">
            These medications were extracted from medication list using AI. Please review each medication carefully for accuracy before adding them.
          </p>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {extractedMedications.length} medication(s) found. Review and edit as needed, then click &quot;Add Bulk Medications&quot; to add them.
        </p>

        <div className="max-h-[500px] overflow-y-auto">
          <BaseTable
            columns={reviewColumns}
            data={extractedMedications}
            headerStyles="pt-[5px]"
            cellStyles={(field) =>
              field === "id" ? " justify-end h-full" : "flex h-full"
            }
            tableContainerClass="bg-white"
          />
        </div>

        {extractedMedications.length > 0 && (
          <div className="flex justify-end items-center mt-4 pt-4 border-t border-gray-200">
            <Button
              buttonClick={handleClose}
              name="Cancel"
              type="button"
              disabled={isPending}
              classname="flex items-center px-6 h-[50px] border border-transparent shadow-sm text-[16px] font-poppins font-semibold rounded-md text-white bg-[#3089AB] mr-4"
            />
            <Button
              buttonClick={handleApproveAll}
              name={isPending ? "Adding Medications..." : "Add Bulk Medications"}
              type="button"
              isLoading={isPending}
              disabled={isPending}
              classname="flex items-center px-6 h-[50px] border border-transparent shadow-sm text-[16px] font-poppins font-semibold rounded-md text-white bg-[#3089AB]"
            />
          </div>
        )}

        {extractedMedications.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No medications to review.</p>
          </div>
        )}
      </div>

      {editModalOpen && editingMedication && (
        <CommonModal
          title="Edit Medication"
          modalOpen={editModalOpen}
          setModalOpen={handleCloseEditModal}
          titleClass="text-[24px] font-semibold"
          crossCTA={true}
          width="675px"
          className="py-4"
        >
          <div className="px-[20px]">
            <Form
              onSubmit={handleEditSubmit}
              schema={ClinicalSchema}
              defaultValues={{ medication: editingMedication }}
            >
              <AddMedicationForm defaultValues={editingMedication} />
            </Form>
          </div>
        </CommonModal>
      )}
    </CommonModal>
  );
};

export default MedicationReviewModal;
