import _ from "lodash";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import { UpdateLeadOrSeniorSchema } from "../../../model/crm/user.model";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { handleSetCarePlanLeadActiveTab } from "../../../redux/slices/tab-slice";
import useUpdate from "../../../services/update";
import {
  leadCarePlanTabConstants,
  levelOfCareOptions,
  milestones,
  housekeepingServiceOptions,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  InHomeCare,
  ADL_TEMPLATE_EXTRACTION_URL,
  CUSTOM_TEMPLATE_MAX_SIZE_MB,
  ADD_SERVICE_CATEGORY_OPTIONS,
  SECTION_CATEGORY_MAP,
  SECTION_LABELS,
  adlAndHousekepping,
  sectionHeadings,
  DEFAULT_ADL_FIELDS,
  DEFAULT_ADL_KEYS,
  vitalSignsData,
  basePath,
  ServiceSection,
  CAREPLAN_PATH_OMIT_FIELDS,
} from "../../../utils/constants";
import { omit } from "../../../utils/dateUtils";
import { useGetHomeType } from "../../../utils/gethomeType";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import { getUserRoleFromToken, getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import { useContext, useEffect, useRef, useState } from "react";
import { RoleContext } from "../../role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import CommonModal from "../../../commonComponents/common-modal";
import AiLoader from "../../../commonComponents/ai-loader";
import { uploadToS3, getFileUrl } from "../../../utils/uploadToS3";
import PlusIcon from "../../../public/icons/plus-icon";
import ToggleSwitch from "../../../commonComponents/toggle-switch";
import { Upload, TriangleAlert } from "lucide-react";
import InputcheckboxComponent from "../../../commonComponents/input-checkbox-component";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import SelectComponent from "../../../commonComponents/select-component";




const getAdlServiceKeys = (careplanData: any): string[] => {
  const adl = (careplanData?.carePlan as Record<string, any>)?.adl ?? {};
  return Object.keys(adl).filter(
    (k) => k !== "comments" && typeof adl[k] === "object" && adl[k] !== null
  );
};

const isCustomAdlKey = (key: string) => !DEFAULT_ADL_KEYS.has(key);

const hasCustomCarePlanKeys = (careplanData: any): boolean => {
  const adlKeys = getAdlServiceKeys(careplanData);
  if (adlKeys.some(isCustomAdlKey)) return true;

  const housekeeping =
    (careplanData?.carePlan as Record<string, any>)?.housekeeping ?? {};
  const hkKeys = Object.keys(housekeeping);
  if (hkKeys.some(isCustomAdlKey)) return true;

  const defaultVitalKeys = new Set(
    vitalSignsData
      .map((vital) => vital.name.split(".").pop())
      .filter((key): key is string => Boolean(key))
  );
  const vitalSigns =
    (careplanData?.carePlan as Record<string, any>)?.vitalSigns ?? {};
  const vitalKeys = Object.keys(vitalSigns);
  if (vitalKeys.some((key) => !defaultVitalKeys.has(key))) return true;

  return false;
};


// Allowed file types for custom template upload
const CUSTOM_TEMPLATE_ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

type TemplateMode = "default" | "custom";

interface ExtractedAdlField {
  label: string;
  options?: { option: string; value: string }[];
  name: string;
  section?: ServiceSection;
}


interface ExtractedService {
  id: string;
  name: string;
  category: string;
  section: ServiceSection;
  selected: boolean;
}


function Index({ careplanData }: any) {
  const { mutate, isPending } = useUpdate();
    const tokenRole = getUserRoleFromToken();
      const providerRole = useContext(RoleContext)?.role;
      const contextRole = tokenRole ?? providerRole;
    
      const [role, setRole] = useState<string | undefined>(contextRole);
      const [editAccess, setEditAccess] = useState<boolean>(false);
      const [canCustomizeAdls, setCanCustomizeAdls] = useState<boolean>(false);
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
         setCanCustomizeAdls(
          hasAccess(role as Role, "SENIOR_CUSTOMIZE_ADLS", "EDIT") || false
        );
      }, [role, careplanData]);
      useEffect(()=>{
        setIsDisabled(!editAccess)
      },[role,editAccess])
  const dispatch = useAppDispatch();
  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const formSchema = UpdateLeadOrSeniorSchema(isInHomeCare);
  const homeId = getHomeIdFromToken();

const sessionKey =
  `adl_custom_fields_${careplanData?.userId ?? "unknown"}`;

  // Template toggle & state — auto-enable if DB has non-default ADL keys or session has custom fields
  const [customFields, setCustomFields] = useState<ExtractedAdlField[]>(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      return stored ? (JSON.parse(stored) as ExtractedAdlField[]) : [];
    } catch {
      return [];
    }
  });

  const hasSessionCustomFields = customFields.length > 0;

  const [useTemplate, setUseTemplate] = useState(
    () => hasCustomCarePlanKeys(careplanData) || hasSessionCustomFields
  );
  const [templateMode, setTemplateMode] = useState<TemplateMode>(
    () =>
      (hasCustomCarePlanKeys(careplanData) || hasSessionCustomFields)
        ? "custom"
        : "default"
  );
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [extractedServices, setExtractedServices] = useState<ExtractedService[]>([]);
  const [addServiceName, setAddServiceName] = useState("");
  const [addServiceCategory, setAddServiceCategory] = useState<ServiceSection>("adl");
  // Keep newServiceInputs for handleAddService compat (section-based)
  const [newServiceInputs, setNewServiceInputs] = useState<
    Record<ServiceSection, { name: string; category: string }>
  >({
    adl: { name: "", category: "Personal Care" },
    vitals: { name: "", category: "Vital Signs" },
    housekeeping: { name: "", category: "Housekeeping" },
  });
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = getUserIdFromToken();

  // Clear session on actual page refresh/close — tab switches don't trigger this
  useEffect(() => {
    const clearOnUnload = () => {
      try { sessionStorage.removeItem(sessionKey); } catch {}
    };
    window.addEventListener("beforeunload", clearOnUnload);
    return () => window.removeEventListener("beforeunload", clearOnUnload);
  }, [sessionKey]);

  // Derive fields from DB data; fall back to DEFAULT_ADL_FIELDS if nothing saved yet
  const getDbFields = (): ExtractedAdlField[] => {
    const adl = (careplanData?.carePlan as Record<string, any>)?.adl ?? {};
    const hk = (careplanData?.carePlan as Record<string, any>)?.housekeeping ?? {};

    const adlKeys = Object.keys(adl).filter(
      (key) => key !== "comments" && typeof adl[key] === "object" && adl[key] !== null
    );
    const hkKeys = Object.keys(hk);

    const buildLabel = (key: string) =>
      key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");

    if (adlKeys.length === 0 && hkKeys.length === 0) {
      return DEFAULT_ADL_FIELDS.map(({ key, label, section, path }) => ({
        label,
        options: section === "housekeeping" ? housekeepingServiceOptions : levelOfCareOptions,
        name: path ?? `${basePath}.${key}.careLevel`,
        section,
      }));
    }

    const fields: ExtractedAdlField[] = [];

    for (const key of adlKeys) {
      const defaultEntry = DEFAULT_ADL_FIELDS.find((d) => d.key === key);
      const label = defaultEntry?.label ?? `${buildLabel(key)} - Level of Care:`;
      fields.push({
        label,
        options: levelOfCareOptions,
        name: defaultEntry?.path ?? `${basePath}.${key}.careLevel`,
        section: "adl",
      });
    }

    for (const key of hkKeys) {
      const defaultEntry = DEFAULT_ADL_FIELDS.find((d) => d.key === key);
      const label = defaultEntry?.label ?? `${buildLabel(key)}:`;
      fields.push({
        label,
        options: housekeepingServiceOptions,
        name: defaultEntry?.path ?? `carePlan.housekeeping.${key}`,
        section: "housekeeping",
      });
    }

    return fields;
  };

  // Toggle handler
  const handleToggleTemplate = () => {
    if (useTemplate) {
      // Turning OFF — revert to DB-derived fields
      setUseTemplate(false);
      setTemplateMode("default");
      setCustomFields([]);
      try { sessionStorage.removeItem(sessionKey); } catch {}
    } else {
      setUseTemplate(true);
    }
  };

  // Get active fields based on template mode
  const getActiveFields = (): ExtractedAdlField[] => {
    if (templateMode === "custom" && customFields.length > 0) {
      return customFields;
    }
    return getDbFields();
  };

  // Custom template upload: validate file
  const handleUploadFile = async (file: File) => {
    if (!CUSTOM_TEMPLATE_ALLOWED_TYPES[file.type]) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "Invalid file format. Please upload a PDF, DOC, or DOCX file."
        )
      );
      return;
    }

    if (file.size > CUSTOM_TEMPLATE_MAX_SIZE_MB * 1024 * 1024) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          `File size exceeds ${CUSTOM_TEMPLATE_MAX_SIZE_MB}MB. Please upload a smaller file.`
        )
      );
      return;
    }

    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      const fileExtension = CUSTOM_TEMPLATE_ALLOWED_TYPES[file.type] || "";
      const base = String(careplanData?.homeId || homeId).replace(/^\/+|\/+$/g, "");
      const seniorUserId = careplanData?.userId || userId;
      const bucketUploadPath = `${base}/${seniorUserId}/carenotes${fileExtension}`;
      const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

      const uploadedFileUrl = await uploadToS3(
        file,
        bucketUploadPath,
        bucketName!,
        false
      );

      if (!uploadedFileUrl) {
        throw new Error("Upload failed. Please try again.");
      }
      setIsUploading(false);
      setUploadModalOpen(false);

      // Start processing — generate presigned URL and extract
      handleExtractAdlFields(bucketName!, bucketUploadPath);
    } catch (error: any) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          error?.message || "Upload failed. Please try again."
        )
      );
      setIsUploading(false);
    }
  };

  // Extract ADL fields from uploaded document (mirrors bulk medication extraction flow)
  const handleExtractAdlFields = async (bucket: string, key: string) => {
    if (!bucket || !key) return;

    setIsProcessing(true);

    try {
      const presignedUrl = await getFileUrl(bucket, key);
      if (!presignedUrl) {
        throw new Error("Unable to access the uploaded document.");
      }
      const response = await fetch(ADL_TEMPLATE_EXTRACTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: presignedUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to extract ADL fields from template";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // server returned non-JSON
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Unexpected response from server. Please try again.");
      }

      const data = await response.json();

      // API returns { categories: [{ name, services: [...] }] }
      const categories = data.categories || [];
      const allServices: string[] = [];
      for (const cat of categories) {
        if (Array.isArray(cat.services)) {
          for (const svc of cat.services) {
            if (svc && !allServices.includes(svc)) {
              allServices.push(svc);
            }
          }
        }
      }

      // Build services preserving category + assigning section
      const services: ExtractedService[] = [];
      for (const cat of categories) {
        const categoryName: string = cat.name || "Other";
        const section: ServiceSection = SECTION_CATEGORY_MAP[categoryName] ?? "adl";
        if (Array.isArray(cat.services)) {
          for (const svc of cat.services) {
            if (svc && !services.some((s) => s.name === svc)) {
              services.push({
                id: `svc-${services.length}-${Date.now()}`,
                name: svc,
                category: categoryName,
                section,
                selected: true,
              });
            }
          }
        }
      }
      setExtractedServices(services);
      setReviewModalOpen(true);
    } catch (error: any) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          error?.message || "Failed to process template. Please try again."
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Review modal: confirm selected services → convert to form fields
 const handleConfirmServices = () => {
  const selected = extractedServices.filter(
    (service) => service.selected
  );

  if (selected.length === 0) return;

  const fields: ExtractedAdlField[] = selected.map(
    (service) => {
      const normalizedKey = service.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      // Preserve word boundaries in vital-sign keys so the UI can render readable labels.
      // e.g. "Pulse / Heart Rate" -> "pulseHeartRate"
      const camelCaseKey = service.name
        .replace(/[^a-zA-Z0-9]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word, i) =>
          i === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join("");

      if (service.section === "housekeeping") {
        return {
          label: `${service.name}:`,
          options: housekeepingServiceOptions,
          name: `carePlan.housekeeping.${normalizedKey}`,
          section: "housekeeping",
        };
      }

      if (service.section === "vitals") {
        return {
          label: service.name,
          name: `carePlan.vitalSigns.${camelCaseKey}`,
          section: "vitals",
        };
      }

      return {
        label: `${service.name} - Level of Care:`,
        options: levelOfCareOptions,
        name: `carePlan.adl.${normalizedKey}.careLevel`,
        section: "adl",
      };
    }
  );

  // Keep ADLs, vitals, and housekeeping for payload creation.
  setCustomFields(fields);

  try {
    sessionStorage.setItem(sessionKey, JSON.stringify(fields));
  } catch {}

  setTemplateMode("custom");
  setReviewModalOpen(false);

  dispatch(handleOpenPopover());
  dispatch(
    handleShowPopoverMessage(
      `${fields.length} service(s) applied from template`
    )
  );

  // Persist the newly-selected services immediately with default values,
  // so the modal Confirm button saves to the DB just like the form Save button.
  const existingAdl = (careplanData?.carePlan as Record<string, any>)?.adl ?? {};
  const existingVitalSigns =
    (careplanData?.carePlan as Record<string, any>)?.vitalSigns ?? {};
  const existingHousekeeping =
    (careplanData?.carePlan as Record<string, any>)?.housekeeping ?? {};

  const initialData: any = {
    carePlan: {
      adl: {},
      vitalSigns: {},
      housekeeping: {},
    },
  };

  for (const field of fields) {
    const parts = field.name.split(".");
    const objectName = parts[1];
    const serviceKey = parts[2];
    if (!serviceKey) continue;

    if (objectName === "adl" && parts.length >= 4) {
      initialData.carePlan.adl[serviceKey] = {
        careLevel:
          existingAdl[serviceKey]?.careLevel ?? "Independent",
      };
    } else if (objectName === "vitalSigns") {
      initialData.carePlan.vitalSigns[serviceKey] =
        typeof existingVitalSigns[serviceKey] === "boolean"
          ? existingVitalSigns[serviceKey]
          : true;
    } else if (objectName === "housekeeping") {
      initialData.carePlan.housekeeping[serviceKey] =
        existingHousekeeping[serviceKey] ?? "Not Required";
    }
  }

  saveCarePlan(initialData, fields);
};
  // Review modal: toggle service selection
  const handleToggleService = (id: string) => {
    setExtractedServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  // Review modal: add a missing service to a specific section
  const handleAddService = (section: ServiceSection) => {
    const { name: trimmed, category } = {
      name: newServiceInputs[section].name.trim(),
      category: newServiceInputs[section].category,
    };
    if (!trimmed) return;
    if (extractedServices.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("This service already exists."));
      return;
    }
    setExtractedServices((prev) => [
      ...prev,
      { id: `svc-${Date.now()}`, name: trimmed, category, section, selected: true },
    ]);
    setNewServiceInputs((prev) => ({
      ...prev,
      [section]: { ...prev[section], name: "" },
    }));
  };

  // Review modal: remove a service
  // const handleRemoveService = (id: string) => {
  //   setExtractedServices((prev) => prev.filter((s) => s.id !== id));
  // };

const saveCarePlan = (
  data: any,
  activeFieldsOverride?: ExtractedAdlField[]
) => {
  const formattedData = _.merge({}, careplanData, data);
  const cleanedData: any = omit(formattedData, USER_PATH_OMIT_FIELDS);

  if (!cleanedData.carePlan) {
    cleanedData.carePlan = {};
  }

  const existingCarePlan =
    (careplanData?.carePlan as Record<string, any>) ?? {};

  const fieldsToUse = activeFieldsOverride ?? activeFields;

  /*
   * Collect active keys separately.
   */
  const allowedAdlKeys = fieldsToUse
    .filter(
      (field) =>
        field.section === "adl" && field.name.split(".")[1] === "adl"
    )
    .map((field) => field.name.split(".")[2])
    .filter((key): key is string => Boolean(key));

  const allowedVitalKeys = fieldsToUse
    .filter(
      (field) =>
        field.section === "vitals" &&
        field.name.split(".")[1] === "vitalSigns"
    )
    .map((field) => field.name.split(".")[2])
    .filter((key): key is string => Boolean(key));

  const allowedHousekeepingKeys = fieldsToUse
    .filter(
      (field) =>
        field.section === "housekeeping" &&
        field.name.split(".")[1] === "housekeeping"
    )
    .map((field) => field.name.split(".")[2])
    .filter((key): key is string => Boolean(key));

  /*
   * Build ADLs.
   *
   * Iterate through active keys, not the submitted object's keys.
   * This guarantees every active ADL receives a careLevel.
   */
  const filteredAdl: Record<string, any> = {};

  for (const key of allowedAdlKeys) {
    const submittedCareLevel =
      data?.carePlan?.adl?.[key]?.careLevel;

    const defaultCareLevel =
      adlDefaults?.[key]?.careLevel;

    const existingCareLevel =
      existingCarePlan?.adl?.[key]?.careLevel;

    filteredAdl[key] = {
      careLevel:
        submittedCareLevel ??
        defaultCareLevel ??
        existingCareLevel ??
        "Independent",
    };
  }

  const comments =
    data?.carePlan?.adl?.comments ??
    existingCarePlan?.adl?.comments;

  if (comments !== undefined) {
    filteredAdl.comments = comments;
  }

  cleanedData.carePlan.adl = filteredAdl;

  /*
   * Build template vital-sign services separately.
   */
 const filteredVitalSigns: Record<string, boolean> = {};

for (const key of allowedVitalKeys) {
  const submittedValue =
    data?.carePlan?.vitalSigns?.[key];

  const existingValue =
    careplanData?.carePlan?.vitalSigns?.[key];

  filteredVitalSigns[key] =
    typeof submittedValue === "boolean"
      ? submittedValue
      : typeof existingValue === "boolean"
        ? existingValue
        : vitalSignsDefaults[key] ?? false;
}

cleanedData.carePlan.vitalSigns =
  filteredVitalSigns;

  /*
   * Preserve existing Overall Health vital-sign properties
   * while adding the template-generated services.
   */
  cleanedData.carePlan.vitalSigns = {
    ...(existingCarePlan.vitalSigns ?? {}),
    ...filteredVitalSigns,
  };

  /*
   * Build housekeeping separately.
   */
  const filteredHousekeeping: Record<string, any> = {};

  for (const key of allowedHousekeepingKeys) {
    filteredHousekeeping[key] =
      data?.carePlan?.housekeeping?.[key] ??
      housekeepingDefaults?.[key] ??
      existingCarePlan?.housekeeping?.[key] ??
      "Not Required";
  }

  cleanedData.carePlan.housekeeping =
    filteredHousekeeping;

  /*
   * Preserve fields not controlled by this form.
   */
  (
    ["behaviourPatterns", "physicalHealth"] as const
  ).forEach((key) => {
    if (existingCarePlan[key] !== undefined) {
      cleanedData.carePlan[key] =
        existingCarePlan[key];
    }
  });

  const payload = {
    data: cleanedData,
    path: UserPath,
  };

  mutate(payload, {
    onSuccess: () => {
      dispatch(handleOpenPopover());
      dispatch(
        handleShowPopoverMessage(
          "Data Saved Successfully"
        )
      );
      dispatch(
        handleSetCarePlanLeadActiveTab(
          leadCarePlanTabConstants.OVERALL_HEALTH_TAB
        )
      );
    },

    onError: (error: any) => {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          error?.message || "Failed to save data. Please try again."
        )
      );
    },
  });
};

const handleFormSubmit = (data: any) => {
  saveCarePlan(data);
};

  const userData = omit(careplanData, CAREPLAN_PATH_OMIT_FIELDS);

  const activeFields = getActiveFields();
  const isProcessingState = isUploading || isProcessing;

  // Dynamically build default values from activeFields
  // This supports both static (known) and dynamic (extracted) services
const existingAdl =
  (userData?.carePlan as Record<string, any>)?.adl ?? {};

const existingHousekeeping =
  (userData?.carePlan as Record<string, any>)?.housekeeping ?? {};

const existingVitalSigns =
  (userData?.carePlan as Record<string, any>)?.vitalSigns ?? {};

const adlDefaults: Record<string, any> = {
  ...existingAdl,
};

const housekeepingDefaults: Record<string, any> = {
  ...existingHousekeeping,
};

const vitalSignsDefaults: Record<string, any> = {
  ...existingVitalSigns,
};

for (const field of activeFields) {
  const parts = field.name.split(".");
  const objectName = parts[1];
  const serviceKey = parts[2];

  if (!serviceKey) continue;

  if (objectName === "adl" && parts.length >= 4) {
    if (!adlDefaults[serviceKey]) {
      adlDefaults[serviceKey] = {};
    }

    adlDefaults[serviceKey].careLevel =
      existingAdl?.[serviceKey]?.careLevel ?? "Independent";
  }

 if (
    objectName === "vitalSigns" &&
    parts.length >= 3
  ) {
    vitalSignsDefaults[serviceKey] =
      typeof existingVitalSigns[serviceKey] === "boolean"
        ? existingVitalSigns[serviceKey]
        : false;
  }

  if (objectName === "housekeeping" && parts.length >= 3) {
    if (housekeepingDefaults[serviceKey] === undefined) {
      housekeepingDefaults[serviceKey] =
        existingHousekeeping?.[serviceKey] ?? "Not Required";
    }
  }
}

const defaultValues = {
  ...userData,
  carePlan: {
    ...((userData?.carePlan as Record<string, any>) ?? {}),
    adl: adlDefaults,
    vitalSigns: vitalSignsDefaults,
    housekeeping: housekeepingDefaults,
  },
};
  
  // Disable form if lead is deleted or has lost milestone
  const isDeletedOrLost = careplanData?.isDeleted || careplanData?.milestone?.includes(milestones.LOST);
  
  return (
    <>
      <Form
        key={`careplan-adl-form-${role}-${editAccess}-${templateMode}`}
        schema={formSchema}
        onSubmit={handleFormSubmit}
        defaultValues={defaultValues}
        disabled={!editAccess}
      >
        <div className="flex flex-col w-full justify-center">
          <div className="flex flex-col !bg-white shadow-lg rounded-md p-[30px] max-w-[1114px] mx-auto items-center">
            {/* Header row with toggle — only visible to roles with SENIOR_CUSTOMIZE_ADLS access */}
            {canCustomizeAdls && (
              <div className="flex w-full items-center justify-end mb-4 gap-3">
                <ToggleSwitch
                  label="Use Template"
                  defaultEnabled={useTemplate}
                  onToggle={handleToggleTemplate}
                />
              </div>
            )}

            {/* Processing state — matches bulk medication loader */}
            {isProcessingState ? (
              <div className="flex flex-col items-center justify-center py-8 w-full">
                <AiLoader
                  message={
                    isUploading
                      ? "Uploading template"
                      : "Processing template"
                  }
                  subtitle="This may take a few seconds"
                />
              </div>
            ) : (
              <>
                {/* Use Custom Template button — only when toggle is ON and user has customize access */}
                {useTemplate && canCustomizeAdls && (
                  <div className="flex w-full justify-end mb-4">
                    <Button
                      name="Use Custom Template"
                      type="button"
                      icon={<PlusIcon color="#ffffff" />}
                      buttonClick={() => setUploadModalOpen(true)}
                    />
                  </div>
                )}

                {/* ADL fields grouped by section */}
                <div className="flex flex-col items-start gap-[2vh] w-full">
                  {(["adl", "housekeeping"] as ServiceSection[]).map(
                    (section) => {
                    const sectionFields = activeFields.filter((f) => (f.section ?? "adl") === section);
                    if (sectionFields.length === 0) return null;
                    
                    return (
                      <div key={section} className="w-full">
                        <p className="text-sm font-semibold text-gray-600 px-[30px] mb-1 mt-2">{sectionHeadings[section]}</p>
                        <div className="flex flex-wrap justify-center">
                          {sectionFields.map((adl) => (
                            <div key={adl.name} className="px-[30px] py-[15px]">
                              <FormSelectComponent
                                label={adl.label}
                                options={adl.options}
                                name={adl.name}
                                className="w-[356px] m-[10px]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center w-full">
                  <div className="flex-1 !max-w-[625px]">
                    <FormTextareaComponent
                      label={"Comments"}
                      className={"max-w-[625px] mb-[20px]"}
                      onChange={(e) => void {}}
                      name={"carePlan.adl.comments"}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex pt-[20px] self-center justify-center">
            <Button
              name="Save"
              classname="w-[350px]"
              buttonClick={() => {}}
              isLoading={isPending}
              disabled={isDisabled || isProcessingState}
            />
          </div>
        </div>
      </Form>

      {/* Custom Template Upload Modal */}
      <CommonModal
        title="Upload Custom Template"
        modalOpen={uploadModalOpen}
        setModalOpen={setUploadModalOpen}
        titleClass="text-[24px] font-medium"
        crossCTA={!isProcessingState}
        width="550px"
        className="py-4"
      >
        <div className="px-6 ">
          {isProcessingState ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AiLoader
                message={
                  isUploading
                    ? "Uploading document..."
                    : "Processing template..."
                }
                subtitle="This may take a few seconds"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center ">
              <p className="text-sm text-gray-500 text-center">
                Please upload a custom template document to extract ADL fields.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="hidden"
              />
              <Button
                name="Upload Template"
                buttonClick={() => fileInputRef.current?.click()}
                icon={<Upload size={16} />}
                classname="!text-white"
              />
            </div>
          )}
        </div>
      </CommonModal>

      {/* Review Extracted Services Modal */}
      <CommonModal
        title="Review Extracted Services"
        modalOpen={reviewModalOpen}
        setModalOpen={setReviewModalOpen}
        titleClass="text-[24px] font-medium"
        crossCTA={true}
        width="680px"
        className="py-4"
      >
        <div className="flex flex-col w-full">
          {/* Scrollable content */}
          <div className="px-6 pt-4 pb-2 overflow-y-auto" style={{ maxHeight: "55vh" }}>
            {/* AI warning banner */}
            {extractedServices.length > 0 ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
                <TriangleAlert size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 m-0">
                  These services were extracted from care notes using AI. Please review each service before adding them.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5">
                <TriangleAlert size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 m-0">
                  We couldn't automatically detect ADL services from this document. You can add custom fields below.
                </p>
              </div>
            )}

            {/* 3 sections */}
            {(["adl", "vitals", "housekeeping"] as ServiceSection[]).map((section) => {
              const sectionServices = extractedServices.filter((s) => s.section === section);
              const selectedCount = sectionServices.filter((s) => s.selected).length;
              return (
                <div key={section} className="mb-5 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                    <p className="text-sm font-semibold text-gray-800">{SECTION_LABELS[section]}</p>
                    <p className="text-xs text-gray-400">{selectedCount}/{sectionServices.length}</p>
                  </div>
                  {sectionServices.length > 0 ? (
                    sectionServices.map((svc) => (
                      <div key={svc.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0">
                        <InputcheckboxComponent
                          value={svc.selected}
                          label={svc.name}
                          name={svc.id}
                          onChange={() => handleToggleService(svc.id)}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-400 italic">
                      No services detected for this section.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Single Add Service row + sticky Confirm footer */}
          <div className="px-6 pt-3 pb-4 border-t border-gray-200 bg-white">
            {/* Add service row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1">
                <InputFieldComponent
                  label=""
                  name="newServiceGlobal"
                  placeholder="Add a missing service..."
                  value={addServiceName}
                  onChange={(e) => setAddServiceName(e.target.value)}
                  containerClass="!gap-0"
                  titleClass="!hidden"
                />
              </div>
              <SelectComponent
                name="addServiceCategory"
                options={ADD_SERVICE_CATEGORY_OPTIONS}
                value={addServiceCategory}
                onChange={(e) => setAddServiceCategory(e.target.value as ServiceSection)}
                className="!max-w-[150px]"
              />
              <Button
                name="Add"
                type="button"
                icon={<PlusIcon color="#ffffff" />}
                buttonClick={() => {
                  const trimmed = addServiceName.trim();
                  if (!trimmed) return;
                  if (extractedServices.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(handleShowPopoverMessage("This service already exists."));
                    return;
                  }
                  setExtractedServices((prev) => [
                    ...prev,
                    { id: `svc-${Date.now()}`, name: trimmed, category: addServiceCategory, section: addServiceCategory, selected: true },
                  ]);
                  setAddServiceName("");
                }}
                classname="!text-white"
              />
            </div>

            {/* Confirm button */}
            <Button
              name="Confirm"
              type="button"
              buttonClick={handleConfirmServices}
              disabled={extractedServices.filter((s) => s.selected).length === 0}
              classname="!text-white w-full"
            />
          </div>
        </div>
      </CommonModal>
    </>
  );
}

export default Index;
