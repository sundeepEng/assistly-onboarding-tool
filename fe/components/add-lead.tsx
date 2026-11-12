import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import Button from "../commonComponents/button";
import Form from "../commonComponents/form";
import FormInputFieldComponent from "../commonComponents/form-input-field-component";
import FormSelectComponent from "../commonComponents/form-select-component";
import Loader from "../commonComponents/loader";
import { CreateLeadSchema } from "../model/crm/user.model";
import useGetAll from "../services/getAll";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import { handleCloseAddLeadModal } from "../redux/slices/modal-slice";
import useCreate from "../services/create";
import useGetById from "../services/getById";
import {
  GetUsersPath,
  homePath,
  InHomeCare,
  milestones,
  UserPath,
  userRoles,
} from "../utils/constants";
import { useRouter } from "next/router";
import { createDocumentObjectsFromS3Folder } from "../utils/createDocumentsFromS3";
import { getUserIdFromToken, getHomeIdFromToken, getIsSalesRequiredFromCookie } from "../utils/auth";
import { useGetHomeType } from "../utils/gethomeType";

interface AddLeadProps {
  tourDateTime: string;
  setTourDateTime: (value: string) => void;
  loading?: boolean;
  leadOwnerOptions: { option: string; value: string }[];
  isSalesRequired: boolean;
}
const AddLead: React.FC<AddLeadProps> = ({
  tourDateTime,
  setTourDateTime,
  loading,
  leadOwnerOptions,
  isSalesRequired,
}) => {
  const { getValues } = useFormContext();
  /**
   * Handle all input changes dynamically
   * Works for text inputs, select dropdowns, date, and time pickers.
   */
  const handleDateChange = (date: any) => {
    if (date) {
      setTourDateTime(date.toISOString());
    } else {
      setTourDateTime("");
    }
  };

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;

  const handleTimeChange = (time: any) => {
    if (tourDateTime && time) {
      const [hours, minutes] = time?.split(":");
      const dateWithTime = new Date(tourDateTime);
      dateWithTime?.setHours(parseInt(hours, 10), parseInt(minutes, 10));
      setTourDateTime(dateWithTime?.toISOString());
    }
  };
  return (
    <div className="w-[360px]">
      <FormInputFieldComponent
        name="firstName"
        label="First Name *"
        placeholder="Enter First Name"
      />
      <FormInputFieldComponent
        name="middleName"
        label="Middle Name"
        placeholder="Enter Middle Name"
      />
      <FormInputFieldComponent
        name="lastName"
        label="Last Name *"
        placeholder="Enter Last Name"
      />
      <FormInputFieldComponent
        name="email"
        label="Email"
        placeholder="Enter Email"
      />
      <FormInputFieldComponent
        name="mobile"
        label={isInHomeCare ? "Phone Number *" : "Phone Number"}
        placeholder="Enter Phone Number"
      />
      {isSalesRequired && (
        <FormSelectComponent
          name="isReferredByUserId"
          label="Lead Owner"
          options={leadOwnerOptions}
          placeHolder="Select Lead Owner"
        />
      )}

      {/* Home Tour Dropdown */}
      {/* <FormSelectComponent
                className="font-poppins"
                name="tour_scheduled"
                label="Home Tour"
                options={booleanOptions}
            /> */}

      {/* Conditionally Render DateTimePicker */}
      {/* {tourScheduled === Yes && (
                <DateTimePicker
                    onDateChange={handleDateChange}
                    onTimeChange={handleTimeChange}
                />
            )} */}
      <div className="flex items-center justify-center pt-[20px]">
        <Button
          name={"Save"}
          buttonClick={() => {}}
          isLoading={loading || false}
        ></Button>
      </div>
    </div>
  );
};

export const AddLeadFormWrapper = () => {
  const [tourDateTime, setTourDateTime] = useState<string>("");
  const [loader, setLoader] = useState(false);
  const { mutate } = useCreate();
  const dispatch = useDispatch();
  const router = useRouter();
  const user = getUserIdFromToken();
  const homeId = getHomeIdFromToken();
  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const { data: HomeData } = useGetById({
    key: "user",
    payload: { path: homePath, id: homeId, enabled: !!homeId },
  });

  const { data: pchoData } = useGetAll({
    key: "pcho-users",
    params: { userType: userRoles.PCHO, homeId },
    path: GetUsersPath,
  });
  const { data: salesDirectorData } = useGetAll({
    key: "sales-director-users",
    params: { userType: userRoles.SALES_DIRECTOR, homeId },
    path: GetUsersPath,
  });
  const { data: salesRepData } = useGetAll({
    key: "sales-rep-users",
    params: { userType: userRoles.SALES_REPRESENTATIVE, homeId },
    path: GetUsersPath,
  });

  const leadOwnerOptions = useMemo(() => {
    const allUsers = [
      ...(pchoData?.users || []),
      ...(salesDirectorData?.users || []),
      ...(salesRepData?.users || []),
    ];
    return allUsers.map((user: { name: string; userId: string }) => ({
      option: user.name,
      value: user.userId,
    }));
  }, [pchoData, salesDirectorData, salesRepData]);

  const handleSubmitAddLeadData = async (data: any) => {
    setLoader(true);

    try {
      const docs = await createDocumentObjectsFromS3Folder(
        homeId,
        user,
        "Senior",
        isInHomeCare,
      );

      let { email } = data;
      email = email?.trim().toLowerCase();

      // When isSalesRequired but the user never touched the lead-owner select,
      // react-hook-form may submit an empty string for isReferredByUserId.
      // Fall back to defaultLeadOwner (the logged-in user) in that case.
      const resolvedLeadOwner =
        data?.isReferredByUserId || (isSalesRequired ? defaultLeadOwner : undefined);

      const formData: any = {
        ...data,
        homeId: homeId,
        home: HomeData?.home?.homeName,
        role: userRoles.LEAD,
        name: [data?.firstName, data?.middleName, data?.lastName]
          .filter(Boolean)
          .join(" "),
        email,
        milestone: [milestones.INITIAL_CONTACT],
        documents: JSON.parse(JSON.stringify(docs)),
        ...(resolvedLeadOwner ? { isReferredByUserId: resolvedLeadOwner } : {}),
      };

      await new Promise<void>((resolve, reject) =>
        mutate(
          { userData: formData, path: UserPath },
          {
            onSuccess: () => {
              dispatch(handleCloseAddLeadModal());
              dispatch(handleOpenPopover());
              dispatch(
                handleShowPopoverMessage("New Senior Lead added successfully!"),
              );
              router.push("/crm");
              resolve();
            },
            onError: (error: any) => {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  !Array?.isArray(error?.response?.data?.error)
                    ? error?.response?.data?.error
                    : "Failed to add Senior Lead.",
                ),
              );
              reject(error);
            },
          },
        ),
      );
    } catch (err) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(String(err?.response?.data?.error)));
    } finally {
      setLoader(false); // reset after full mutation + re-render
    }
  };

  const isSalesRequired = getIsSalesRequiredFromCookie() ?? false;
  
  // Set logged-in user as default lead owner
  const defaultLeadOwner = useMemo(() => {
    const loggedInUserOption = leadOwnerOptions.find(option => option.value === user);
    return loggedInUserOption?.value || "";
  }, [leadOwnerOptions, user]);
  
  // Show loading until lead owner options are loaded (if sales is required)
  const isLoadingLeadOwnerOptions = isSalesRequired && leadOwnerOptions.length === 0;
  
  if (isLoadingLeadOwnerOptions) {
    return <Loader fullScreen={false} />;
  }
  
  return (
    <div>
      <Form
        key={`add-lead-form-${leadOwnerOptions.length}`}
        onSubmit={handleSubmitAddLeadData}
        schema={CreateLeadSchema(isInHomeCare)}
        defaultValues={{ isReferredByUserId: defaultLeadOwner }}
      >
        <AddLead
          tourDateTime={tourDateTime}
          setTourDateTime={setTourDateTime}
          loading={loader}
          leadOwnerOptions={leadOwnerOptions}
          isSalesRequired={isSalesRequired}
        />
      </Form>
    </div>
  );
};

export default AddLead;
