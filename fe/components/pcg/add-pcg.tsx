import { useRouter } from "next/router";
import Button from "../../commonComponents/button";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import { CreatePCHOOrPCGLeadSchema } from "../../model/crm/user.model";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { handleCloseAddPCGModal } from "../../redux/slices/modal-slice";
import useCreate from "../../services/create";
import useGetById from "../../services/getById";
import { homePath, UserPath, userRoles } from "../../utils/constants";
import { createDocumentObjectsFromS3Folder } from "../../utils/createDocumentsFromS3";
import { getUserIdFromToken, getHomeIdFromToken } from "../../utils/auth";
import { useState } from "react";

const AddPCG = () => {
  const { mutate } = useCreate();
  const [loader, setLoader] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const userId = getUserIdFromToken();
  const homeId = getHomeIdFromToken();
  const { data: HomeData } = useGetById({
    key: "user",
    payload: { path: homePath, id: homeId,enabled:!!homeId },
  });

  const handleSubmitPCGData = async (data) => {
    setLoader(true);
    try {
      // 1) Await the docs so we don't log a Promise
      const docs = await createDocumentObjectsFromS3Folder(
        homeId,
        userId,
        "PCG"
      );

      // 2) Snapshot to avoid DevTools live mutation in logs
      const docsSnapshot = JSON.parse(JSON.stringify(docs));
      let { email } = data;
      email = email?.trim().toLowerCase();
      const formData = {
        ...data,
        email,
        name: [data?.firstName, data?.middleName, data?.lastName]
          .filter(Boolean)
          .join(" "),
        role: userRoles.PCGLEAD,
        mobile: data?.mobile,
        home: HomeData?.home?.homeName,
        homeId: homeId,
        documents: docsSnapshot,
      };

      mutate(
        { userData: formData, path: UserPath },
        {
          onSuccess: () => {
            dispatch(handleCloseAddPCGModal());
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Care Lead Added Successfully")
            );
            router.push("/crm/pcg");
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to add Care Lead."
              )
            );
          },
        }
      );
    } catch (err) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(String(err?.message ?? err)));
    }
    setLoader(false);
  };

  return (
    <Form onSubmit={handleSubmitPCGData} schema={CreatePCHOOrPCGLeadSchema}>
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
          <Button
            name={"Save"}
            buttonClick={() => {}}
            isLoading={loader || false}
          ></Button>
        </div>
      </div>
    </Form>
  );
};

export default AddPCG;
