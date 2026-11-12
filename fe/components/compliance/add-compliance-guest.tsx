import React, { useState } from "react";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import Button from "../../commonComponents/button";
import { CreateComplianceGuestSchema } from "../../model/crm/user.model";
import { homePath, UserPath, userRoles } from "../../utils/constants";
import Cookies from "js-cookie";
import useGetById from "../../services/getById";
import useCreate from "../../services/create";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { handleCloseAddGuestModal } from "../../redux/slices/modal-slice";
import { useRouter } from "next/router";
import { getHomeIdFromToken } from "../../utils/auth";

const AddComplianceGuest = () => {
  const [isLoading,setIsLoading]=useState(false)
  const { mutate } = useCreate();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const homeId = getHomeIdFromToken();
  const { data: HomeData } = useGetById({
    key: "user",
    payload: { path: homePath, id: homeId ,enabled:!!homeId},
  });
  const handleSubmitGuestData = (data: any) => {
    setIsLoading(true)
    let {email}=data
    email=email?.trim().toLowerCase()

    const formData = {
      ...data,
      email,
      name: [data?.firstName, data?.middleName, data?.lastName]
        .filter(Boolean)
        .join(" "),
      role: userRoles.COMPLIANCE_GUEST,
      home: HomeData?.home?.homeName,
      homeId: homeId,
    };
    mutate(
      { userData: formData, path: UserPath },
      {
        onSuccess: () => {
          dispatch(handleCloseAddGuestModal());
          dispatch(handleOpenPopover());
          dispatch(
            handleShowPopoverMessage("Compliance Guest Added Successfully")
          );
          router.push("/crm/complianceguest");
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              !Array?.isArray(error?.response?.data?.error)
                ? error?.response?.data?.error
                : "Failed to add Compliance Guest."
            )
          );
        },
      }
    );
          setIsLoading(false)
  };
  return (
    <div>
      <Form
        onSubmit={handleSubmitGuestData}
        schema={CreateComplianceGuestSchema}
      >
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
            <Button name={"Save"} buttonClick={() => {} }  isLoading={isLoading || false}></Button>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default AddComplianceGuest;
