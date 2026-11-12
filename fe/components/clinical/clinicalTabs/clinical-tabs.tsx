import React from "react";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import Tabs from "../../../commonComponents/tabs";
import useGetById from "../../../services/getById";
import {
  CLINICAL,
  InHomeCare,
  UserPath,
  userRoles,
  docusealCreateSubmissionURL,
} from "../../../utils/constants";
import useCreate from "../../../services/create";
import { hasAccess } from "../../../utils/roleAccess";
import { Access, Role } from "../../../utils/roles";
import Layout from "../../layout";
import { ProtectedComponent } from "../../protectedComponent";
import { RoleContext } from "../../role-provider";
import Careplan from "./careplan";
import IncidentReport from "./incident-report";
import Medication from "./medication";
import Medpass from "./medpass";
import OverTheCounter from "./over-the-counter";
import ProfileCarousel from "./profile-carousel";
import Loader from "../../../commonComponents/loader";
import { getHomeIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import Button from "../../../commonComponents/button";
import PlusIcon from "../../../public/icons/plus-icon";
import CommonModal from "../../../commonComponents/common-modal";
import PopoverComponent from "../../../commonComponents/popover-component";
import {
  handleOpenAddIncidentModal,
  handleOpenAddMedicationModal,
  handleOpenOverTheCounterMediactionModal,
} from "../../../redux/slices/modal-slice";
import { useDispatch } from "react-redux";
import SelectComponent from "../../../commonComponents/select-component";
import EmarDataLayer from "../../../utils/emarDataLayer";
import useCommentUsers from "../../../utils/useCommentUsers";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
  handleShowWarningMessage,
} from "../../../redux/slices/exception-popover-slice";
import fetchPreSignedUrl from "../../../services/get-presigned-url";
import { useGenerateCarePlan } from "../../../services/chat-with-openai";
import { CARE_PLAN_TEMPLATE_PLACEHOLDERS } from "../../../utils/constants";
import { generateFilledDocx } from "../../../utils/documentUtils";
import {
  getS3PreSignedFromattedUrl,
  getS3PublicUrl,
  uploadToS3,
} from "../../../utils/uploadToS3";
import { ChevronDown, Eye as FiEye, Sparkles } from "lucide-react";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { useGetHomeType } from "../../../utils/gethomeType";
import { GenerateEmarPdf, downloadEmarPdf } from "../../generate-emar";
import { GenerateCarePlanPdf, downloadCarePlanPdf } from "../../generate-care-plan";
import EmarActionModal from "../emar-action-modal";
import CarePlanDataLayer from "../../../utils/carePlanDataLayer";
import DocusealFormModal from "../../documents/docuseal-form-modal";
import { getUserEmailFromToken } from "../../../utils/auth";
import BulkMedicationModal from "./bulk-medication-modal";
import ToggleSwitch from "../../../commonComponents/toggle-switch";

export interface TabData {
  label: string;
  content: JSX.Element;
  access?: { feature: string; type: Access | Access[] }[];
}
const ClinicalTabs = ({ seniorID }: { seniorID: string }) => {
  const { mutateAsync: createSubmission } = useCreate();
  const [roleAccess, setRoleAccess] = useState(false);
  const [emarActionOpen, setEmarActionOpen] = useState(false);
  const [emarResult, setEmarResult] = useState<any>(null);
  const [emarMonth, setEmarMonth] = useState<string>("");
  const [emarLoading, setEmarLoading] = useState(false);
  const [signingModalOpen, setSigningModalOpen] = useState(false);
  const [signingTitle, setSigningTitle] = useState("E-Sign Document");
  const [docusealSlug, setDocusealSlug] = useState<string | null>(null);
  const [docusealLoading, setDocusealLoading] = useState(false);
  const [docusealError, setDocusealError] = useState<string | null>(null);
  const [carePlanActionOpen, setCarePlanActionOpen] = useState(false);
  const [carePlanResult, setCarePlanResult] = useState<any>(null);
  const [carePlanMonth, setCarePlanMonth] = useState<string>("");
  const [carePlanLoading, setCarePlanLoading] = useState(false);
  const homeId = getHomeIdFromToken();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const {
    data: seniorData,
    isLoading,
    refetch,
  } = useGetById({
    key: userRoles.SENIOR,
    payload: {
      id: seniorID,
      path: UserPath,
      enabled: !!seniorID,
    },
  });
  const medPassUserIds =
    seniorData?.clinical?.medPass?.services
      ?.map((u) => u?.providedBy)
      .filter((id): id is string => Boolean(id)) || [];

  const carePlanUserIds =
    seniorData?.clinical?.carePlan?.services
      ?.map((service) => service?.providedBy)
      .filter((id): id is string => Boolean(id)) || [];

  const userIds = [...medPassUserIds, ...carePlanUserIds];

  const { userMap } = useCommentUsers({
    userIds,
    path: UserPath,
  });
  useEffect(() => {
    setRoleAccess(
      hasAccess(role as Role, "CLINICAL_TABS", "EDIT") ||
      hasAccess(role as Role, "CLINICAL_TABS", "VIEW"),
    );
  }, [role]);

  const router = useRouter();
  const data = router?.query;
  const tabData: TabData[] = [
    {
      label: "Medication",
      content: <Medication seniorData={seniorData} />,
      access: [
        { feature: "CLINICAL_MEDICATION", type: "VIEW" },
        { feature: "CLINICAL_MEDICATION", type: "EDIT" },
      ],
    },
    {
      label: "MedPass",
      content: <Medpass seniorData={seniorData} refetch={refetch} />,
      access: [
        { feature: "CLINICAL_MEDPASS", type: "VIEW" },
        { feature: "CLINICAL_MEDPASS", type: "EDIT" },
      ],
    },
    {
      label: "Over-The-Counter Medication",
      content: <OverTheCounter seniorData={seniorData} />,
      access: [
        { feature: "CLINICAL_OTC", type: "VIEW" },
        { feature: "CLINICAL_OTC", type: "EDIT" },
      ],
    },
    {
      label: "Care Plan",
      content: <Careplan seniorData={seniorData} />,
      access: [
        { feature: "CLINICAL_CAREPLAN", type: "VIEW" },
        { feature: "CLINICAL_CAREPLAN", type: "EDIT" },
      ],
    },
    {
      label: "Incident Report",
      content: <IncidentReport seniorData={seniorData} />,
      access: [
        { feature: "CLINICAL_INCIDENT", type: "VIEW" },
        { feature: "CLINICAL_INCIDENT", type: "EDIT" },
      ],
    },
  ];
  const filteredTabData = tabData?.filter(
    (tab) =>
      tab?.access?.some(({ feature, type }) =>
        hasAccess(role as Role, feature, type),
      ) || hasAccess(role as Role, "CLINICAL_TABS", "EDIT"),
  );

  const [activeTab, setActiveTab] = useState<string>(
    (data?.activeTab as string) || filteredTabData[0]?.label,
  );

  const [carePlanActionsOpen, setCarePlanActionsOpen] = useState(false);
  const [carePlanLoadingModalOpen, setCarePlanLoadingModalOpen] =
    useState(false);
  const [carePlanLoadingText, setCarePlanLoadingText] =
    useState("Preparing...");
  const [carePlanGenerateAccess, setCarePlanGenerateAccess] = useState(false);

  const setProfileActiveTab = () => {
    setActiveTab(filteredTabData[0]?.label);
  };
  const hasMedicationOcrAccess = hasAccess(
    role as Role,
    "MEDICATION_OCR_EXTRACTION",
    "EDIT",
  );

  useEffect(() => {
    setCarePlanGenerateAccess(
      hasAccess(role as Role, "CLINICAL_CAREPLAN", "EDIT") ||
      hasAccess(role as Role, "CLINICAL_TABS", "EDIT") ||
      false,
    );
  }, [role]);

  const dispatch = useDispatch();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const emarOptions = [
    { value: "", option: "Generate EMAR" },
    ...Array.from({ length: 12 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      const value = date.toISOString().slice(0, 7); // "YYYY-MM"
      const option = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }); // "July 2025"
      return { value, option };
    }),
  ];

  const carePlanOptions = [
    { value: "", option: "Generate Care Report" },
    ...Array.from({ length: 12 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      const value = date.toISOString().slice(0, 7); // "YYYY-MM"
      const option = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }); // "July 2025"
      return { value, option };
    }),
  ];

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const isInhomeCarePCGUser = role === userRoles.PCG && isInHomeCare;

  const { mutate: generatePlan } = useGenerateCarePlan();

  const handleViewCarePlan = async () => {
    try {
      const bucket =
        process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME || "";
      const region = process.env.NEXT_PUBLIC_AWS_REGION! || "";
      const key = `${homeId}/${seniorID}/elderly_care_plan.docx`;

      // Server-side existence check (avoids S3 CORS issues that can break client-side HEAD).
      const existsResp = await fetch("/api/s3/exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bucket, key }),
      });

      if (!existsResp.ok) {
        throw new Error("Failed to verify care plan availability");
      }

      const existsData: any = await existsResp.json();
      if (!existsData?.exists) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "You must generate the care plan prior to viewing it.",
          ),
        );
        return;
      }

      const s3FileURL = getS3PreSignedFromattedUrl({
        bucket,
        region,
        key,
      });

      const enabled = !!s3FileURL;
      if (!enabled) return;
      const s3Url = await fetchPreSignedUrl(s3FileURL);
      if (!s3Url) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("File not found"));
        return;
      }

      window.open(s3Url, "_blank");
    } catch (err) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "You must generate the care plan prior to viewing it.",
        ),
      );
    }
  };

  const handleGenerateCarePlan = () => {
    if (!carePlanGenerateAccess) return;
    if (!seniorData) return;

    setCarePlanLoadingModalOpen(true);
    setCarePlanLoadingText("Gathering resident information...");

    const carePlanObject = (seniorData as any)?.carePlan || {};

    const extractPlaceholders = (obj: any, prefix = ""): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? extractPlaceholders(v, prefix ? `${prefix}.${k}` : k)
          : [prefix ? `${prefix}.${k}` : k],
      );

    const placeholders = extractPlaceholders(CARE_PLAN_TEMPLATE_PLACEHOLDERS);

    generatePlan(
      {
        carePlanObject,
        placeholders,
      },
      {
        onSuccess: async (data: any) => {
          try {
            setCarePlanLoadingText(
              "Reviewing care needs and support levels...",
            );

            const bucketName =
              process.env.NEXT_PUBLIC_AWS_ORIGINAL_CONTRACTS_BUCKET_NAME;
            const base = String((seniorData as any)?.homeId).replace(
              /^\/+|\/+$/g,
              "",
            );
            const encodedKey = `${base}/Senior/elderly_care_plan_template.docx`;
            const documentUrl = getS3PublicUrl({
              bucket: bucketName!,
              region: process.env.NEXT_PUBLIC_AWS_REGION!,
              key: encodedKey,
            });

            setCarePlanLoadingText("Creating personalized care plan...");

            const preparedData = prepareElderlyCareDocData(data);
            preparedData.fullName = (seniorData as any)?.name || "";
            preparedData.dateOfBirth =
              (seniorData as any)?.biography?.personalDetails?.birthdate || "";
            preparedData.roomNumber =
              (seniorData as any)?.clinical?.roomNumber || "";
            preparedData.emergencyContact =
              (seniorData as any)?.biography?.personalDetails
                ?.emergencyContactNumber || "";
            preparedData.phone = (seniorData as any)?.mobile || "";

            setCarePlanLoadingText("Preparing downloadable document...");

            const docBlob = await generateFilledDocx(documentUrl, preparedData);
            const fileName = `${base}/${seniorID}/elderly_care_plan.docx`;
            const file = new File([docBlob], "care_plan.docx", {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

            setCarePlanLoadingText("Saving care plan securely...");

            const uploadedUrl = await uploadToS3(
              file,
              fileName,
              process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME!,
              false,
            );

            if (!uploadedUrl) {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  "Failed to upload the generated care plan.",
                ),
              );
              setCarePlanLoadingModalOpen(false);
              return;
            }

            setCarePlanLoadingText("Completed!");
            setTimeout(() => {
              setCarePlanLoadingModalOpen(false);
              dispatch(handleOpenPopover());
              dispatch(
                handleShowPopoverMessage(
                  "Care Plan Generated and Uploaded Successfully",
                ),
              );
            }, 800);
          } catch (e: any) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                String(e?.message || "Error generating care plan."),
              ),
            );
            setCarePlanLoadingModalOpen(false);
          }
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              String(error?.message || "Error generating care plan."),
            ),
          );
          setCarePlanLoadingModalOpen(false);
        },
      },
    );
  };

  const authorizedModules = useAuthorizedModules();
  const hasClinicalAccess = authorizedModules.includes(CLINICAL.toUpperCase());
  return (
    <Layout>
      {roleAccess && hasClinicalAccess ? (
        <>
          <CommonModal
            modalOpen={carePlanLoadingModalOpen}
            setModalOpen={setCarePlanLoadingModalOpen}
            width="400px"
            crossCTA={false}
            title="Processing"
          >
            <div className="flex flex-col items-center justify-center p-4">
              <div className="loader border-4 border-gray-300 border-t-blue-500 rounded-full w-12 h-12 animate-spin"></div>
              <div className="mt-4 text-center text-[16px] font-medium">
                {carePlanLoadingText}
              </div>
            </div>
          </CommonModal>

          <ProtectedComponent
            role={role as Role}
            feature="CLINICAL_CAROUSEL"
            access="EDIT"
          >
            {!isInhomeCarePCGUser && (
              <ProfileCarousel setActiveTab={setProfileActiveTab} />
            )}
          </ProtectedComponent>
          <div className="px-4">
            <div className="bg-gray-100 p-4">
              {isLoading ? (
                <Loader fullScreen={false} />
              ) : (
                <Tabs
                  tabs={filteredTabData}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  containerClassName="rounded-t-[10px] pt-[5px]"
                  activeTabClassName="text-[black] text-2xl"
                  tabComponent={
                    <div
                      className={`${seniorData?.isDeleted
                        ? "!cursor-not-allowed opacity-20"
                        : "cursor-pointer"
                        }`}
                    >
                      <div
                        className={`${seniorData?.isDeleted && "pointer-events-none"
                          }`}
                      >
                        {activeTab === "Medication" ? (
                          <div className="flex items-center gap-3">
                            {hasMedicationOcrAccess && (
                              <ToggleSwitch
                                label="Bulk"
                                defaultEnabled={isBulkMode}
                                onToggle={(enabled) => setIsBulkMode(enabled)}
                              />
                            )}
                            <Button
                              name={
                                isBulkMode
                                  ? "Add Bulk Medication"
                                  : "Add Medication"
                              }
                              icon={<PlusIcon color="white" />}
                              classname="!text-white "
                              iconStart={true}
                              buttonClick={() => {
                                if (isBulkMode) {
                                  setIsBulkModalOpen(true);
                                } else {
                                  dispatch(handleOpenAddMedicationModal());
                                }
                              }}
                            />
                          </div>
                        ) : activeTab === "MedPass" ? (
                          <SelectComponent
                            label={""}
                            options={emarOptions}
                            name={""}
                            className=""
                            onChange={(e) => {
                              const month = e.target.value;
                              if (!month) return;
                              const result = EmarDataLayer(
                                seniorData,
                                userMap,
                                month,
                                dispatch,
                              );
                              if (result) {
                                setEmarResult(result);
                                setEmarMonth(month);
                                setEmarActionOpen(true);
                              }
                            }}
                          />
                        ) : activeTab === "Over-The-Counter Medication" ? (
                          <ProtectedComponent
                            role={role as Role}
                            feature="CLINICAL_OTC_ADD"
                            access="EDIT"
                          >
                            <Button
                              name={"Add Over-the-Counter Medication"}
                              icon={<PlusIcon color="white" />}
                              classname="!text-white w-[270px]"
                              iconStart={true}
                              buttonClick={() => {
                                dispatch(
                                  handleOpenOverTheCounterMediactionModal(),
                                );
                              }}
                            />
                          </ProtectedComponent>
                        ) : activeTab === "Incident Report" ? (
                          <ProtectedComponent
                            role={role as Role}
                            feature="CLINICAL_INCIDENT_ADD"
                            access="EDIT"
                          >
                            <Button
                              name={"Add Incident"}
                              icon={<PlusIcon color="white" />}
                              classname="!text-white"
                              iconStart={true}
                              buttonClick={() => {
                                dispatch(handleOpenAddIncidentModal());
                              }}
                            />
                          </ProtectedComponent>
                        ) : activeTab === "Care Plan" ? (
                          <div className="flex items-center gap-3">
                            <SelectComponent
                              label={""}
                              options={carePlanOptions}
                              name={"carePlanMonth"}
                              className="w-56"
                              onChange={(e) => {
                                const month = e.target.value;
                                if (!month) return;
                                const result = CarePlanDataLayer(seniorData, month, userMap);
                                const hasServiceData = result?.rows?.some((r) =>
                                  r.days?.some((d) => d.status || d.value)
                                );
                                const hasVitalData =
                                  (result?.vitalSignReadings?.length ?? 0) > 0;

                                if (hasServiceData || hasVitalData) {
                                  setCarePlanResult(result);
                                  setCarePlanMonth(month);
                                  setCarePlanActionOpen(true);
                                } else {
                                  // No recorded data for the month: warn like EMAR
                                  // and do not generate/open the action popup.
                                  dispatch(handleOpenPopover());
                                  dispatch(handleShowCloseOptions());
                                  dispatch(handleShowWarningMessage());
                                  dispatch(
                                    handleShowPopoverMessage(
                                      "No care plan services recorded during selected period",
                                    ),
                                  );
                                }
                              }}
                            />
                            <PopoverComponent
                              isOpen={carePlanActionsOpen}
                              setIsOpen={setCarePlanActionsOpen}
                              body={
                                <div className="w-[180px]">
                                  <div
                                    className={`flex items-center gap-2 p-[5px] hover:rounded-md font-poppins ${carePlanGenerateAccess
                                      ? "cursor-pointer hover:bg-lightgray"
                                      : "cursor-not-allowed opacity-50"
                                      }`}
                                    onClick={() => {
                                      if (!carePlanGenerateAccess) return;
                                      setCarePlanActionsOpen(false);
                                      handleGenerateCarePlan();
                                    }}
                                  >
                                    <Sparkles size={16} />
                                    <div>Generate</div>
                                  </div>

                                  <div
                                    className="flex items-center gap-2 p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                                    onClick={() => {
                                      setCarePlanActionsOpen(false);
                                      handleViewCarePlan();
                                    }}
                                  >
                                    <FiEye size={16} />
                                    <div>View</div>
                                  </div>
                                </div>
                              }
                            >
                              <div className="bg-[#111827] text-white px-4 py-2 rounded-md cursor-pointer flex items-center gap-2">
                                <div>Care Plan Actions</div>
                                <ChevronDown size={16} />
                              </div>
                            </PopoverComponent>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  }
                />
              )}
            </div>
          </div>
          {isBulkModalOpen && (
            <BulkMedicationModal
              seniorData={seniorData}
              isOpen={isBulkModalOpen}
              onClose={() => setIsBulkModalOpen(false)}
            />
          )}
        </>
      ) : (
        <div>
          <RestrictedPage />
        </div>
      )}
      <EmarActionModal
        open={emarActionOpen}
        setOpen={setEmarActionOpen}
        loading={emarLoading}
        onDownload={() => {
          if (emarResult && emarMonth) {
            downloadEmarPdf(emarResult, emarMonth);
          }
        }}
        onESign={async () => {
          if (!emarResult || !emarMonth) return;
          setEmarLoading(true);
          try {
            setSigningTitle("E-Sign EMAR");
            // Generate PDF with signature placeholder
            const { pdfBytes } = await GenerateEmarPdf(emarResult, emarMonth, {
              includeSignaturePlaceholder: true,
            });

            // Convert to base64
            let binary = "";
            const bytes = new Uint8Array(pdfBytes);
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const pdfBase64 = btoa(binary);

            // Create DocuSeal submission via backend
            const email = getUserEmailFromToken() || "";
            const resp = await createSubmission({
              userData: {
                pdfBase64,
                signerEmail: email,
                // signerName: seniorData?.name || "",
              },
              path: docusealCreateSubmissionURL,
            });

            const slug = resp?.data?.data?.slug || resp?.data?.slug;
            setDocusealSlug(slug);
            setEmarActionOpen(false);
            setSigningModalOpen(true);
          } catch (e: any) {
            console.error(e);
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                e?.message || "Failed to prepare e-signature",
              ),
            );
          } finally {
            setEmarLoading(false);
          }
        }}
      />

      <EmarActionModal
        open={carePlanActionOpen}
        setOpen={setCarePlanActionOpen}
        loading={carePlanLoading}
        title="Care Report Generated"
        description="Your care plan monthly record has been generated successfully. What would you like to do?"
        esignFeature="CLINICAL_CAREREPORT_ESIGN"
        onDownload={() => {
          if (carePlanResult && carePlanMonth) {
            downloadCarePlanPdf(carePlanResult, carePlanMonth);
          }
        }}
        onESign={async () => {
          if (!carePlanResult || !carePlanMonth) return;
          setCarePlanLoading(true);
          try {
            setSigningTitle("E-Sign Care Report");
            const { pdfBytes } = await GenerateCarePlanPdf(
              carePlanResult,
              carePlanMonth,
              { includeSignaturePlaceholder: true },
            );

            let binary = "";
            const bytes = new Uint8Array(pdfBytes);
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const pdfBase64 = btoa(binary);

            const email = getUserEmailFromToken() || "";
            const resp = await createSubmission({
              userData: {
                pdfBase64,
                signerEmail: email,
              },
              path: docusealCreateSubmissionURL,
            });

            const slug = resp?.data?.data?.slug || resp?.data?.slug;
            setDocusealSlug(slug);
            setCarePlanActionOpen(false);
            setSigningModalOpen(true);
          } catch (e: any) {
            console.error(e);
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                e?.message || "Failed to prepare e-signature",
              ),
            );
          } finally {
            setCarePlanLoading(false);
          }
        }}
      />

      <DocusealFormModal
        open={signingModalOpen}
        setOpen={setSigningModalOpen}
        docusealSlug={docusealSlug}
        docusealLoading={docusealLoading}
        docusealError={docusealError}
        email={getUserEmailFromToken() || ""}
        title={signingTitle}
      />
    </Layout>
  );
};

function prepareElderlyCareDocData(apiResponse: any): Record<string, string> {
  const residentInfo = apiResponse.ResidentInformation || {};
  const careSupportInfo = apiResponse.CarePlanAndSupport || {};

  return {
    fullName: residentInfo.FullName || "",
    dateOfBirth: residentInfo.DateOfBirth || "",
    roomNumber: residentInfo.RoomNumber || "",
    primaryCaregiver: residentInfo.PrimaryCaregiver || "",
    emergencyContact: residentInfo.EmergencyContact || "",
    phone: residentInfo.ContactPhone || "",
    knownConditions: residentInfo.KnownConditions || "",

    MentalHealth: careSupportInfo.MentalHealth || "",
    SpeechPatterns: careSupportInfo.SpeechPatterns || "",
    EmotionalState: careSupportInfo.EmotionalState || "",
    MedicationAdherence: careSupportInfo.MedicationAdherence || "",
    SocialInteraction: careSupportInfo.SocialInteraction || "",
    PhysicalHealth: careSupportInfo.PhysicalHealth || "",
    SafetyMeasures: careSupportInfo.SafetyMeasures || "",
    GroomingMeasures: careSupportInfo.GroomingMeasures || "",
  };
}

export default ClinicalTabs;
