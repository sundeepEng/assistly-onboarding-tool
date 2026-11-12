import Button from "../../commonComponents/button";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import { CreateReferralSchema } from "../../model/crm/user.model";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { handleCloseAddReferralModal, handleCloseEditReferralModal } from "../../redux/slices/modal-slice";
import useCreate from "../../services/create";
import useUpdate from "../../services/update";
import useGetById from "../../services/getById";
import {
  homePath,
  NOT_CONTACTED,
  UserPath,
  userRoles,
} from "../../utils/constants";
import { useRouter } from "next/router";
import { getHomeIdFromToken } from "../../utils/auth";
import { useState } from "react";

// Props interface for AddReferral component
interface AddReferralProps {
  initialData?: any; // Initial data for edit mode
  isEdit?: boolean; // Flag to indicate if in edit mode
}

const AddReferral = ({ initialData, isEdit = false }: AddReferralProps) => {
  const { mutate: createMutate } = useCreate();
  const { mutate: updateMutate } = useUpdate();
  const [loader, setLoader] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const homeId = getHomeIdFromToken();
  const { data: HomeData } = useGetById({
    key: "user",
    payload: { path: homePath, id: homeId, enabled: !!homeId },
  });

  const handleSubmitReferralData = (data) => {
    setLoader(true);
    let { email } = data;
    email = email?.trim().toLowerCase();
    
    // Build form data for both create and update
    const formData = {
      ...data,
      name: [data?.firstName, data?.middleName, data?.lastName]
        .filter(Boolean)
        .join(" "),
      role: userRoles.REFERRAL,
      email,
      mobile: data?.mobile,
      home: HomeData?.home?.homeName,
      homeId: homeId,
      referralOrgName: data?.referralOrgName,
      // Only set status on create, preserve existing status on edit
      referralFollowupStatus: isEdit ? initialData?.referralFollowupStatus : NOT_CONTACTED,
    };

    // Switch between create and update based on isEdit flag
    if (isEdit) {
      // Update existing referral
      updateMutate(
        { 
          data: { ...formData, userId: initialData?.userId }, 
          path: UserPath 
        },
        {
          onSuccess: () => {
            dispatch(handleCloseEditReferralModal());
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Referral Updated Successfully"));
            router.push("/crm/referral");
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to update Referral"
              )
            );
          },
        }
      );
    } else {
      // Create new referral
      createMutate(
        { userData: formData, path: UserPath },
        {
          onSuccess: () => {
            dispatch(handleCloseAddReferralModal());
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Referral Added Successfully"));
            router.push("/crm/referral");
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to add Referral"
              )
            );
          },
        }
      );
    }
    setLoader(false);
  };

  return (
    <Form 
      onSubmit={handleSubmitReferralData} 
      schema={CreateReferralSchema}
      // Pre-fill form with initial data when in edit mode
      defaultValues={isEdit ? {
        firstName: initialData?.firstName || "",
        middleName: initialData?.middleName || "",
        lastName: initialData?.lastName || "",
        email: initialData?.email || "",
        mobile: initialData?.mobile || "",
        referralOrgName: initialData?.referralOrgName || "",
      } : {}}
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
        <FormInputFieldComponent
          className="mb-[10px]"
          name="referralOrgName"
          label="Referral Organization Name"
          placeholder="Enter Referral Organization Name"
        />
        <div className="flex items-center justify-center pt-[20px]">
          <Button
            name={isEdit ? "Update" : "Save"}
            buttonClick={() => {}}
            isLoading={loader || false}
          ></Button>
        </div>
      </div>
    </Form>
  );
};

export default AddReferral;
