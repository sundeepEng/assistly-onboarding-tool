import { useRouter } from "next/router";
import Button from "../../commonComponents/button";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import { CreateNurseOrNurseLeadSchema } from "../../model/crm/user.model";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { handleCloseAddNurseModal } from "../../redux/slices/modal-slice";
import useCreate from "../../services/create";
import useGetById from "../../services/getById";
import { homePath, UserPath, userRoles } from "../../utils/constants";
import { createDocumentObjectsFromS3Folder } from "../../utils/createDocumentsFromS3";
import { getUserIdFromToken, getHomeIdFromToken } from "../../utils/auth";
import { useState } from "react";

// Add Nurse Lead form.
// Mirrors AddPCG so Nurse Leads start with the default required document seeded from S3.
const AddNurse = () => {
  const { mutate } = useCreate();
  const [loader, setLoader] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const userId = getUserIdFromToken();
  const homeId = getHomeIdFromToken();

  const { data: HomeData } = useGetById({
    key: userRoles.NURSELEAD,
    payload: { path: homePath, id: homeId, enabled: !!homeId },
  });

  // Creates the NurseLead user and seeds their onboarding docs.
  const handleSubmitNurseData = async (data) => {
    setLoader(true);

    try {
      const docs = await createDocumentObjectsFromS3Folder(homeId, userId, "Nurse");
      const docsSnapshot = JSON.parse(JSON.stringify(docs));

      let { email } = data;
      email = email?.trim().toLowerCase();

      const formData = {
        ...data,
        email,
        name: [data?.firstName, data?.middleName, data?.lastName]
          .filter(Boolean)
          .join(" "),
        role: userRoles.NURSELEAD,
        mobile: data?.mobile,
        home: HomeData?.home?.homeName,
        homeId: homeId,
        documents: docsSnapshot,
      };

      mutate(
        { userData: formData, path: UserPath },
        {
          onSuccess: () => {
            dispatch(handleCloseAddNurseModal());
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Nurse Lead Added Successfully"));
            router.push("/crm/nurse");
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to add Nurse Lead.",
              ),
            );
          },
        },
      );
    } catch (err: any) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(String(err?.message ?? err)));
    }

    setLoader(false);
  };

  return (
    <Form onSubmit={handleSubmitNurseData} schema={CreateNurseOrNurseLeadSchema}>
      <div className="w-[360px]">
        <FormInputFieldComponent
          className="mb-[10px]"
          name="firstName"
          label="First Name *"
          placeholder="Enter First Name"
        />
        <FormInputFieldComponent
          className="mb-[10px]"
          name="middleName"
          label="Middle Name"
          placeholder="Enter Middle Name"
        />
        <FormInputFieldComponent
          className="mb-[10px]"
          name="lastName"
          label="Last Name *"
          placeholder="Enter Last Name"
        />
        <FormInputFieldComponent
          className="mb-[10px]"
          name="email"
          label="Email *"
          placeholder="Enter Email"
        />
        <FormInputFieldComponent
          className="mb-[10px]"
          name="mobile"
          label="Phone Number *"
          placeholder="Enter Phone Number"
        />
        <div className="flex items-center justify-center pt-[20px]">
          <Button name={"Save"} buttonClick={() => {}} isLoading={loader || false} />
        </div>
      </div>
    </Form>
  );
};

export default AddNurse;
