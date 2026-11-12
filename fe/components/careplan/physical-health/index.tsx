import _ from "lodash";
import { useRouter } from "next/router";
import { useContext, useEffect, useMemo, useState } from "react";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import { UpdateLeadOrSeniorSchema } from "../../../model/crm/user.model";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import {
  handleSetCarePlanLeadActiveTab,
  handleSetLeadActiveTab,
} from "../../../redux/slices/tab-slice";
import useUpdate from "../../../services/update";
import {
  booleanOptions,
  eyeSightOptions,
  hearingOptions,
  InHomeCare,
  leadActiveTabConstants,
  leadCarePlanTabConstants,
  levelOfPainOptions,
  milestones,
  nursingProceduresOptions,
  recurringIllnessOptions,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  vitalSignsData,
} from "../../../utils/constants";
import { omit } from "../../../utils/dateUtils";
import Choking from "../behaviour-patterns/choking";
import DiabeticsManagement from "./diabetics-management";
import EyeSight from "./eye-sight";
import Hearing from "./hearing";
import NursingProcedures from "./nursing-procedures";
import PainManagement from "./pain-management";
import RecurringIllness from "./recurring-illness";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormInputCheckboxComponent from "../../../commonComponents/form-input-checkbox-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import { useGetHomeType } from "../../../utils/gethomeType";
import { getUserRoleFromToken } from "../../../utils/auth";
import { RoleContext } from "../../role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";

// Define sections for dynamic rendering
const sections = [
  { key: "Pain Management", component: <PainManagement /> },
  { key: "Recurring Illness", component: <RecurringIllness /> },
  { key: "Nursing Procedures", component: <NursingProcedures /> },
  { key: "Eye Sight", component: <EyeSight /> },
  { key: "Hearing", component: <Hearing /> },
  { key: "Diabetic Status", component: <DiabeticsManagement /> },
  { key: "Choking", component: <Choking /> },
];

function Index({ careplanData }: any) {
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
    const isDeletedLead = careplanData?.isDeleted;
    const isLostLead = careplanData?.milestone?.includes(milestones.LOST);
    const isDeletedOrLost = isDeletedLead || isLostLead;
    
    // If deleted or lost, set editAccess to false directly
    if (isDeletedOrLost) {
      setEditAccess(false);
    } else {
      setEditAccess(hasAccess(role as Role, "CRM_BIOGRAPHY_FORMS", "EDIT") || false);
    }
  }, [role, careplanData]);
  useEffect(()=>{
    setIsDisabled(!editAccess)
    },[role,editAccess])
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { mutate, isPending } = useUpdate();
  const handleFormSubmit = (data: any) => {
    const formattedFormData = {
      ...data,
      milestone: Array.from(
        new Set([...data?.milestone, milestones.ON_BOARDING]),
      ),
    };
    const formattedData = _.merge({}, careplanData, formattedFormData);
    const cleanedData: any = omit(formattedData, USER_PATH_OMIT_FIELDS);

    // Preserve ADL-tab-only fields from existing DB data — never overwrite them here
    if (cleanedData?.carePlan) {
      const existingCarePlan = (careplanData?.carePlan as Record<string, any>) ?? {};
      if (existingCarePlan.adl !== undefined) {
        cleanedData.carePlan.adl = existingCarePlan.adl;
      } else {
        delete cleanedData.carePlan.adl;
      }
      if (existingCarePlan.housekeeping !== undefined) {
        cleanedData.carePlan.housekeeping = existingCarePlan.housekeeping;
      } else {
        delete cleanedData.carePlan.housekeeping;
      }
    }

    // Prepare payload and trigger mutation
    const payload = { data: cleanedData, path: UserPath };
    mutate(payload, {
      onSuccess: () => {
        if (router.isReady) {
          dispatch(handleSetLeadActiveTab(leadActiveTabConstants.ACTIONS_TAB));
          dispatch(
            handleSetCarePlanLeadActiveTab(leadCarePlanTabConstants.ADLS_TAB),
          );
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Completed Biography data!"));
        }
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
  const userData = omit(careplanData, [
    "clinical",
    "lastLoginTimestamp",
    "modifiedAt",
    "userId",
    "createdAt",
  ]);
  const baseHealthPath = "carePlan.physicalHealth";
  const physicalHeathData = [
    {
      name: `${baseHealthPath}.painManagementCareLevel`,
      label: "Pain Management",
      options: levelOfPainOptions,
    },
    {
      name: `${baseHealthPath}.recurringIllnessCareLevel`,
      label: "Recurring Illness",
      options: recurringIllnessOptions,
    },
    {
      name: `${baseHealthPath}.nursingProceduresCareLevel`,
      label: "Nursing Procedures",
      options: nursingProceduresOptions,
    },
    {
      name: `${baseHealthPath}.eyeSightCareLevel`,
      label: "Eye Sight",
      options: eyeSightOptions,
    },
    {
      name: `${baseHealthPath}.hearing`,
      label: "Hearing",
      options: hearingOptions,
    },
    {
      name: `${baseHealthPath}.diabetisStatus`,
      label: "Diabetic Status",
      options: booleanOptions,
    },
    {
      name: `${baseHealthPath}.chokingRisk`,
      label: "Choking",
      options: booleanOptions,
    },
  ];
  const baseBehaviourPath = "carePlan.behaviourPatterns";
  const behaviourData = [
    { name: `${baseBehaviourPath}.wanderingRisk`, label: "Wandering Risk" },
    {
      name: `${baseBehaviourPath}.evacuationAssistance`,
      label: "Evacuation Assistance",
    },
  ];
  const existingVitalSigns: Record<string, boolean> =
  careplanData?.carePlan?.vitalSigns ?? {};

  const sessionKey = `adl_custom_fields_${careplanData?.userId ?? "unknown"}`;
  const sessionVitalKeys = useMemo(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as any[];
      return parsed
        .filter((f) => f?.section === "vitals")
        .map((f) => f?.name?.split(".")?.[2])
        .filter((key): key is string => Boolean(key));
    } catch {
      return [];
    }
  }, [sessionKey]);

  const allVitalSigns: Record<string, boolean> = useMemo(() => {
    const result = { ...existingVitalSigns };
    for (const key of sessionVitalKeys) {
      if (!(key in result)) {
        result[key] = false;
      }
    }
    return result;
  }, [existingVitalSigns, sessionVitalKeys]);

  const defaultValues = {
  ...userData,

  carePlan: {
    ...(typeof userData?.carePlan === "object" &&
    userData.carePlan !== null
      ? userData.carePlan
      : {}),

    vitalSigns: allVitalSigns,
  },
};

/*
 * Extract the property name from:
 * carePlan.vitalSigns.bloodPressure
 */
const defaultVitalKeys = new Set(
  vitalSignsData
    .map((vital) => vital.name.split(".").pop())
    .filter((key): key is string => Boolean(key))
);

/*
 * Custom vital signs are keys that are not part
 * of the original vitalSignsData list.
 */
const customVitalKeys = Object.keys(allVitalSigns).filter(
  (key) => !defaultVitalKeys.has(key)
);

const formatVitalLabel = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );

/*
 * If custom vital signs exist, show all saved vital-sign fields.
 * Otherwise, show the standard default fields.
 */
const displayedVitalSigns =
  customVitalKeys.length > 0
    ? Object.keys(allVitalSigns).map((key) => ({
        name: `carePlan.vitalSigns.${key}`,
        label: formatVitalLabel(key),
      }))
    : vitalSignsData;

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const formSchema = UpdateLeadOrSeniorSchema(isInHomeCare);
  return (
    <>
      <Form
        schema={formSchema}
        onSubmit={handleFormSubmit}
        defaultValues={defaultValues}
        disabled={!editAccess}
      >
        <div className="flex flex-col w-full justify-center">
          <div className="flex flex-col !bg-white shadow-lg rounded-md p-[30px] max-w-[1114px] items-center">
            <div className="flex flex-col items-center gap-[4vh] w-full">
              <div className={`flex w-full font-semibold text-[20px]`}>
                Physical Health
              </div>
              <div className="flex flex-wrap justify-center w-full">
                {physicalHeathData?.map((health) => (
                  <div key={health?.label} className="px-[30px] py-[15px]">
                    <FormSelectComponent
                      label={health?.label}
                      options={health?.options}
                      name={health?.name}
                      className="w-[356px] m-[10px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full">
              <div className={`flex w-full font-semibold text-[20px]`}>
                Behaviour Pattern
              </div>
              <div className="p-[30px]">
                <div className="flex flex-wrap items-left">
                  {behaviourData?.map((behaviour) => (
                    <div key={behaviour?.label} className="w-[50%]">
                      <FormInputCheckboxComponent
                        name={behaviour?.name}
                        label={behaviour?.label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full">
              <div className={`flex w-full font-semibold text-[20px]`}>
                Vital Signs
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 justify-start self-start max-w-[1114px] p-[30px]">
                {displayedVitalSigns?.map((vital) => (
                  <div key={vital?.label} className="w-full flex px-[30px] py-[15px]">
                    <FormInputCheckboxComponent
                      name={vital?.name}
                      label={vital?.label}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center w-full">
              <div className="flex-1 max-w-[625px]">
                <FormTextareaComponent
                  label={"Comments"}
                  className={"max-w-[625px] mb-[20px]"}
                  onChange={(e) => void {}}
                  name={`${baseBehaviourPath}.comments`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="flex pt-[20px] self-center justify-center">
              <Button
                name="Save"
                classname="w-[350px]"
                buttonClick={() => {}}
                isLoading={isPending}
                disabled={isDisabled}
              />
            </div>
          </div>
        </div>
      </Form>
    </>
  );
}

export default Index;
