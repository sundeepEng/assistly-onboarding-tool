import _ from "lodash";
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
    basePathMedicalGeneral,
    basePathMedicalMobility,
    basePathMedicalOverallHealth,
    InHomeCare,
    leadActiveTabConstants,
    milestones,
    USER_PATH_OMIT_FIELDS,
    UserPath,
} from "../../utils/constants";
import { omit } from "../../utils/dateUtils";
import General from "./general";
import Mobility from "./mobility";
import OverallHealth from "./overall-health";
import { useGetHomeType } from "../../utils/gethomeType";
import { RoleContext } from "../role-provider";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { getUserRoleFromToken } from "../../utils/auth";

function MedicalForm({ isPending, editAccess, carePlanVitalSigns }: any) {
    const { formState } = useFormContext();
    const [expanded, setExpanded] = useState<string | false>("General");
    const handleAccordionChange = (panel: string) => {
        setExpanded(expanded === panel ? false : panel);
    };

    const sections = [
        { key: "General", component: <General />, path: basePathMedicalGeneral },
        { key: "Mobility", component: <Mobility />, path: basePathMedicalMobility },
        {
            key: "Overall Health",
            component: <OverallHealth carePlanVitalSigns={carePlanVitalSigns} />,
            path: basePathMedicalOverallHealth,
        },
    ];
   return (
  <div className="flex justify-center w-full px-4 pt-4"> {/* Add px for mobile padding */}
    <div className="w-full max-w-[1114px]">
      {sections.map(({ key, component, path }) => {
        const hasError = !!get(formState.errors, path);

        return (
          <div key={key} className="w-full py-[10px]">
            <AccordainComponent
              className=""
              header={
                <div className={`flex items-center justify-between gap-2 ${hasError ? "text-red-500" : ""}`}>
                  {key}
                  {hasError && <WarningIcon fill="red" height={35} width={35} />}
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
      <div className="flex justify-center pt-[20px]">
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

const MedicalFormWrapper = ({ medicalData }: any) => {
   const { mutate, isPending } = useUpdate();
    const tokenRole = getUserRoleFromToken();
    const providerRole = useContext(RoleContext)?.role;
    const contextRole = tokenRole ?? providerRole;
  
    const [role, setRole] = useState<string | undefined>(contextRole);
    const [editAccess, setEditAccess] = useState<boolean>(false);
    const [isDisabled, setIsDisabled] = useState(true);
    useEffect(() => {
        setRole(contextRole);
    }, [contextRole]);
    
    useEffect(() => {
        // Check if lead is deleted or lost - if so, force view-only mode
        const isDeletedLead = medicalData?.isDeleted;
        const isLostLead = medicalData?.milestone?.includes(milestones.LOST);
        const isDeletedOrLost = isDeletedLead || isLostLead;
        
        // If deleted or lost, set editAccess to false directly
        if (isDeletedOrLost) {
          setEditAccess(false);
        } else {
          setEditAccess(hasAccess(role as Role, "CRM_BIOGRAPHY_FORMS", "EDIT") || false);
        }
    }, [role, medicalData]);
    useEffect(()=>{
       setIsDisabled(!editAccess)
    },[role,editAccess])
    const dispatch = useAppDispatch();
    const handleFormSubmit = (data: any) => {
        const formattedData = _.merge({}, medicalData, data);
        // Filter out 'modifiedAt' from the payload
        const cleanedData: any = omit(formattedData, USER_PATH_OMIT_FIELDS);

        // Prepare payload and trigger mutation
        const payload = { data: cleanedData, path: UserPath };
        mutate(payload, {
            onSuccess: () => {
                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage("Data Saved Successfully"));
                dispatch(
                    handleSetLeadActiveTab(leadActiveTabConstants.CAREPLAN_TAB)
                );
            },
            onError: (error:any) => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                 dispatch(
          handleShowPopoverMessage(
            !Array?.isArray(error?.response?.data?.error)
              ? error?.response?.data?.error
              : "Not able to update Biography data of Lead",
          ))
            },
        });
    };
    const userData = omit(medicalData, [
        "clinical",
        "lastLoginTimestamp",
        "modifiedAt",
        "userId",
        "createdAt",
    ]);
  
  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const formSchema = UpdateLeadOrSeniorSchema(isInHomeCare);
  
  // Disable form if lead is deleted or has lost milestone
  const isDeletedOrLost = medicalData?.isDeleted || medicalData?.milestone?.includes(milestones.LOST);
  
    return (
        <Form
            schema={formSchema}
            onSubmit={handleFormSubmit}
            defaultValues={userData}
            disabled={isDisabled || isDeletedOrLost}
        >
            <MedicalForm
            isPending={isPending}
            editAccess={editAccess}
            carePlanVitalSigns={(medicalData as any)?.carePlan?.vitalSigns}
        />
        </Form>
    );
};

export default MedicalFormWrapper;
