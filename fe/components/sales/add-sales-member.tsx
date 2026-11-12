import { useRouter } from "next/router";
import Button from "../../commonComponents/button";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import SelectComponent from "../../commonComponents/select-component";
import { CreateSalesRepresentativeOrSalesDirectorSchema } from "../../model/crm/user.model";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { handleCloseAddSalesMemberModal } from "../../redux/slices/modal-slice";
import useCreate from "../../services/create";
import useGetById from "../../services/getById";
import { homePath, UserPath, userRoles } from "../../utils/constants";
import { getUserIdFromToken, getHomeIdFromToken } from "../../utils/auth";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Role options for the sales team member dropdown (matching backend enum values)
const salesRoleOptions = [
  { option: "Sales Representative", value: "SalesRepresentative" },
  { option: "Sales Director", value: "SalesDirector" },
];

/**
 * AddSalesMember - Form modal to add a new Sales Representative or Sales Director
 * Uses the same create service and user path as other lead creation flows
 * Follows same pattern as AddPCG component
 */
const AddSalesMember = () => {
  const { mutate } = useCreate();
  const [loader, setLoader] = useState(false);
  const [selectedRole, setSelectedRole] = useState("SalesRepresentative");
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = getUserIdFromToken();
  const homeId = getHomeIdFromToken();

  // Fetch home data for homeName
  const { data: HomeData } = useGetById({
    key: "user",
    payload: { path: homePath, id: homeId, enabled: !!homeId },
  });

  /**
   * handleSubmitSalesMember - Handles form submission for new sales member
   * Creates user with selected sales role (SalesRepresentative or SalesDirector)
   */
  const handleSubmitSalesMember = async (data) => {
    setLoader(true);
    try {
      let { email } = data;
      email = email?.trim().toLowerCase();

      // Build the form data with all required fields
      const formData = {
        ...data,
        email,
        name: [data?.firstName, data?.middleName, data?.lastName]
          .filter(Boolean)
          .join(" "),
        role: selectedRole,
        mobile: data?.mobile,
        home: HomeData?.home?.homeName,
        homeId: homeId,
      };

      // Call create API to save sales team member
      mutate(
        { userData: formData, path: UserPath },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [userRoles.SALES_REPRESENTATIVE] });
            queryClient.invalidateQueries({ queryKey: [userRoles.SALES_DIRECTOR] });
            dispatch(handleCloseAddSalesMemberModal());
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Sales Team Member Added Successfully"),
            );
            router.push("/hcm/sales-team");
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to add Sales Team Member.",
              ),
            );
          },
        },
      );
    } catch (err) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(String(err?.message ?? err)));
    }
    setLoader(false);
  };

  return (
    <Form onSubmit={handleSubmitSalesMember} schema={CreateSalesRepresentativeOrSalesDirectorSchema}>
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
        {/* Role selection dropdown - Sales Rep or Sales Director */}
        <SelectComponent
          label="Role *"
          name="salesRole"
          options={salesRoleOptions}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          placeholder="Select Role"
        />
        <div className="flex items-center justify-center pt-[20px]">
          <Button
            name={"Save"}
            buttonClick={() => { }}
            isLoading={loader || false}
          ></Button>
        </div>
      </div>
    </Form>
  );
};

export default AddSalesMember;
