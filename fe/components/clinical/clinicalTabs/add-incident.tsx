import React, { useState } from "react";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import CommonModal from "../../../commonComponents/common-modal";
import { ClinicalSchema } from "../../../model/clinical/clinical.model";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { handleCloseAddIncidentModal } from "../../../redux/slices/modal-slice";
import useUpdate from "../../../services/update";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
} from "../../../utils/constants";
import { omit } from "../../../utils/dateUtils";
import { getUserIdFromToken } from "../../../utils/auth";

interface AddIncidentFormProps {
  userData: any;
  defaultValues?: any;
}

const AddIncidentForm: React.FC<AddIncidentFormProps> = ({
  userData,
  defaultValues,
}) => {
  const { mutate } = useUpdate();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [comments, setComments] = useState("");
  const ownerUserId = getUserIdFromToken();
  const currentDate = new Date().toISOString()?.split("T")[0];

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDescription(e?.target?.value);
  };

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComments(e?.target?.value);
  };

  const handleSubmit = (data: any) => {
    setIsLoading(true);

    if (!ownerUserId) {
      alert("Error: User not authenticated. Please login again.");
      setIsLoading(false);
      return;
    }

    const incidentData = {
      reportedBy: ownerUserId,
      incidentStartTime: data?.incidentReport?.incidentStartTime,
      incidentEndTime: data?.incidentReport?.incidentEndTime,
      reportedDate: currentDate,
      incidentDescription: data?.incidentReport?.incidentDescription,
      comments: data?.incidentReport?.comments || undefined,
    };

    // Prepare only the necessary clinical data
    const clinicalData = {
      ...userData?.clinical,
      incidentReport: [
        ...(userData?.clinical?.incidentReport || []),
        incidentData,
      ],
    };

    // Clean the data and prepare payload
    const cleanedData: any = omit(clinicalData, CLINICAL_USER_PATH_OMIT_FIELDS);
    const payload = {
      data: cleanedData,
      path: ClinicalUserPath,
    };

    // API Call
    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Incident reported successfully"));
        dispatch(handleCloseAddIncidentModal());
        setIsLoading(false);
      },
      onError: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(`Incident not added, Please try again!`)
        );
      },
    });
  };

  const schema = "incidentReport";
  const isAddIncidentModalOpen = useAppSelector(
    (state: { modal: { isAddIncidentModalOpen: boolean } }) =>
      state.modal.isAddIncidentModalOpen
  );

  return (
    <div className="font-poppins w-[550px]">
      <CommonModal
        modalOpen={isAddIncidentModalOpen}
        setModalOpen={() => dispatch(handleCloseAddIncidentModal())}
        crossCTA={true}
        title="Add Incident"
        width="575px"
      >
        <div className="px-[20px]">
        <Form onSubmit={handleSubmit} schema={ClinicalSchema}>
          <div className="flex flex-col gap-6 p-[10px]">
            <div>
              <FormTextareaComponent
                label="Description :"
                name={`${schema}.incidentDescription`}
                // value={description}
                onChange={handleDescriptionChange}
                className="w-[425px] !h-[41px]"
                placeholder="Describe the Incident"
              />
            </div>
            <div>
              <FormInputFieldComponent
                label="Start Time :"
                type="time"
                name={`${schema}.incidentStartTime`}
                className="!w-[310px] !h-[41px]"
                placeholder="HH:MM"
                containerClass={"!flex-row w-full"}
                titleClass="!flex !self-center !w-[100px]"
              />
            </div>
            <div>
              <FormInputFieldComponent
                label="End Time :"
                type="time"
                name={`${schema}.incidentEndTime`}
                className="!w-[310px] !h-[41px]"
                placeholder="HH:MM"
                containerClass={"!flex-row w-full"}
                titleClass="!flex !self-center !w-[100px]"
              />
            </div>
            <div>
              <FormTextareaComponent
                label="Comments :"
                name={`${schema}.comments`}
                // value={comments}
                onChange={handleCommentsChange}
                className=" !h-[41px]"
                placeholder="Additional Comment"
              />
            </div>
            <div className="py-[10px] flex self-center">
              <Button
                buttonClick={() => {}}
                name="Report"
                type="submit"
                isLoading={isLoading}
              />
            </div>
          </div>
        </Form>
        </div>
      </CommonModal>
    </div>
  );
};

export default AddIncidentForm;
