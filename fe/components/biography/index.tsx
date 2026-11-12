import { useContext, useEffect, useState } from "react";
import { get, useFormContext } from "react-hook-form";
import AccordainComponent from "../../commonComponents/accordian-component";
import Button from "../../commonComponents/button";
import Form from "../../commonComponents/form";
import { UpdateLeadOrSeniorSchema } from "../../model/crm/user.model";
import WarningIcon from "../../public/icons/warning-icon";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { handleSetLeadActiveTab } from "../../redux/slices/tab-slice";
import useUpdate from "../../services/update";
import {
  basePathActivityReferences,
  basePathPersonalDetails,
  basePathValues,
  InHomeCare,
  leadActiveTabConstants,
  milestones,
  USER_PATH_OMIT_FIELDS,
  UserPath,
} from "../../utils/constants";
import { omit } from "../../utils/dateUtils";
import Activityreference from "./activity-reference";
import Personaldetails from "./personal-details";
import Values from "./values-beliefs";
import { useGetHomeType } from "../../utils/gethomeType";
import { Role } from "../../utils/roles";
import { hasAccess } from "../../utils/roleAccess";
import { getUserRoleFromToken } from "../../utils/auth";
import { RoleContext } from "../role-provider";

const sections = [
  {
    key: "Personal Details",
    component: <Personaldetails />,
    path: basePathPersonalDetails,
  },
  { key: "Values & Beliefs", component: <Values />, path: basePathValues },
  {
    key: "Activity References",
    component: <Activityreference />,
    path: basePathActivityReferences,
  },
];

function BiographyForm({ isPending,editAccess }: any) {
  const { formState } = useFormContext();
  const [expanded, setExpanded] = useState<string | false>("Personal Details");

  const handleAccordionChange = (panel: string) => {
    setExpanded(expanded === panel ? false : panel);
  };

  return (
    <div className="justify-items-center w-full px-4 pt-4">
      <div className="w-full max-w-[1114px]">
        {sections?.map(({ key, component, path }) => {
          // Check if there is a validation error at the specified path in the form's error object.
          // `get` safely accesses the nested value at `path`. If it exists, `hasError` becomes true.
          const hasError = !!get(formState.errors, path);
          return (
            <div key={key} className="w-full py-[10px]">
              <AccordainComponent
                className=""
                header={
                  <div
                    className={`flex items-center justify-between gap-2 ${
                      hasError && "text-red-500"
                    }`}
                  >
                    {key}
                    {hasError && (
                      <WarningIcon fill="red" height={35} width={35} />
                    )}
                  </div>
                }
                isOpen={expanded === key}
                onClick={() => handleAccordionChange(key)}
              >
                <div>{component}</div>
              </AccordainComponent>
            </div>
          );
        })}
        <div className="justify-items-center pt-[20px]">
          <Button
            name="Save"
            classname="w-[350px]"
            buttonClick={() => {}}
            isLoading={isPending}
            disabled={!editAccess}
          />
        </div>
      </div>
    </div>
  );
}

const BiographyFormWrapper = ({ leadData }: any) => {
  const dispatch = useAppDispatch();
  const { mutate, isPending } = useUpdate();

  const tokenRole = getUserRoleFromToken();
  const providerRole = useContext(RoleContext)?.role;
  const contextRole = tokenRole ?? providerRole;

  const [role, setRole] = useState<string | undefined>(contextRole);
  const [editAccess, setEditAccess] = useState<boolean>(false);
  const [isDisabled, setIsDisabled] = useState(true);
  const normalizeSsnToNumber = (ssn: unknown) => {
    if (ssn === undefined || ssn === null || ssn === "") return ssn;
    const digitsOnly = String(ssn).replace(/\D/g, "");
    return digitsOnly ? Number(digitsOnly) : ssn;
  };
  useEffect(() => {
    setRole(contextRole);
  }, [contextRole]);

  useEffect(() => {
    // Check if lead is deleted or lost - if so, force view-only mode
    const isDeletedLead = leadData?.isDeleted;
    const isLostLead = leadData?.milestone?.includes(milestones.LOST);
    const isDeletedOrLost = isDeletedLead || isLostLead;
    
    // If deleted or lost, set editAccess to false directly
    if (isDeletedOrLost) {
      setEditAccess(false);
    } else {
      setEditAccess(hasAccess(role as Role, "CRM_BIOGRAPHY_FORMS", "EDIT") || false);
    }
  }, [role, leadData]);
  useEffect(()=>{
setIsDisabled(!editAccess)
  },[role,editAccess])
  const handleFormSubmit = (data: any) => {
    const formattedData = {
      ...leadData,
      ...data,
      name: [data?.firstName, data?.middleName, data?.lastName]
        .filter(Boolean)
        .join(" "),
       biography: {
    ...data?.biography,
    personalDetails: {
      ...data?.biography?.personalDetails,
      ssn: normalizeSsnToNumber(data?.biography?.personalDetails?.ssn),
    },
    },
      facesheet:{
        address:{street:data?.facesheet?.street1,
        city:data?.facesheet?.city,
        state:data?.facesheet?.state,
        zipCode:data?.facesheet?.zipCode}
      }
    };

    const cleanedData: any = omit(formattedData, USER_PATH_OMIT_FIELDS);

    const payload = { data: cleanedData, path: UserPath };
    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Data Saved Successfully"));
        dispatch(handleSetLeadActiveTab(leadActiveTabConstants.MEDICAL_TAB));
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            !Array?.isArray(error?.response?.data?.error)
              ? error?.response?.data?.error
              : "Not able to update Biography data of Lead",
          ),
        );
      },
    });
  };
  const userData = omit(leadData, [
    "clinical",
    "lastLoginTimestamp",
    "modifiedAt",
    "userId",
    "createdAt",
  ]);

  const homeType = useGetHomeType();
  const isInhomeCare = homeType === InHomeCare;
  const formSchema = UpdateLeadOrSeniorSchema(isInhomeCare);
  
  // Disable form if lead is deleted or has lost milestone
  const isDeletedOrLost = leadData?.isDeleted || leadData?.milestone?.includes(milestones.LOST);
  
  return (
    <Form
      key={`biography-form-${role}-${editAccess}`}
      schema={formSchema}
      onSubmit={handleFormSubmit}
      defaultValues={userData}
      disabled={isDisabled || isDeletedOrLost}
    >
      <BiographyForm isPending={isPending} editAccess={editAccess}/>
    </Form>
  );
};

export default BiographyFormWrapper;
