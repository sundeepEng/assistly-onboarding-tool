"use client";
import React, { useContext, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import useAuthenticateUser from "../services/authenticate-user";
import useUpdate from "../services/update";
import {
  ClinicalUserPath,
  milestones,
  userRoles,
  userSignUpPath,
  UserPath,
  docuSignPath,
  ESIGN_ENVELOPE_STATUS_COMPLETED,
  USER_PATH_OMIT_FIELDS,
  CLINICAL_USER_PATH_OMIT_FIELDS,
  CLINICAL,
  DocumentCategory,
} from "../utils/constants";

const lostCategoryOptions = [
  "Family Chose Another",
  "Pricing",
  "Location",
  "Timing",
  "Clinical Fit",
  "Other",
] as const;
import {
  handleOpenPopover,
  handleShowPopoverMessage,
  handleShowCloseOptions,
} from "../redux/slices/exception-popover-slice";
import { handleOpenSupportModal } from "../redux/slices/modal-slice";
import { RoleContext } from "./role-provider";
import { Lead } from "./leads-table";
import { omit } from "lodash";
import PopoverComponent from "../commonComponents/popover-component";
import { hasAccess } from "../utils/roleAccess";
import { Role } from "../utils/roles";
import MenuIcon from "../public/icons/menu-icon";
import CommonModal from "../commonComponents/common-modal";
import Button from "../commonComponents/button";
import useCreate from "../services/create";
import { getYYYYMMDDString } from "../utils/dateUtils";
import { TailSpin } from "react-loader-spinner";
import { checkRequiredFilesInS3 } from "../utils/s3Client";
import { PCGLeadRow } from "./pcg-action-cell";
import {
  getHomeIdFromToken,
  getIsSalesRequiredFromCookie,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../utils/auth";
import useDelete from "../services/delete";
import { useAuthorizedModules } from "../utils/useAuthorizedModules";

const LeadActionsCell: React.FC<{ row: Lead }> = ({ row }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const userId = getUserIdFromToken();
  const LoggedInUserhomeId = getHomeIdFromToken();

  const authenticateUser = useAuthenticateUser();
  const { mutate } = useUpdate();

  const { mutate: createMutate } = useCreate();

  const authorizedModules = useAuthorizedModules();

  const hasClinical = authorizedModules.includes(CLINICAL.toUpperCase());

  const handleRegisterLead = (closeMenu: () => void) => {
    if (!row?.email) {
      dispatch(handleOpenPopover());
      dispatch(
        handleShowPopoverMessage(
          "Registration unsuccessful. Email address is required.",
        ),
      );
      dispatch(handleShowCloseOptions());
      closeMenu();
      return;
    }

    authenticateUser.mutate(
      {
        userData: {
          email: row?.email,
          role: row?.role,
        },
        path: userSignUpPath,
      },
      {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Email sent successfully."));
          closeMenu();
        },
        onError: (error: any) => {
          const apiError = error?.response?.data?.error;
          const errorMessage =
            !Array.isArray(apiError) && apiError ? apiError : "Signup failed";
          dispatch(handleOpenPopover());

          dispatch(handleShowPopoverMessage(errorMessage));
          dispatch(handleShowCloseOptions());
          closeMenu();
        },
      },
    );
  };

  const handleCompleteContract = (
    closeMenu: () => void,
    showConfirmError: (message: string) => void,
  ) => {
    const crmData = {
      ...row,
      milestone: Array.from(
        new Set([...(row?.milestone || []), milestones.CONTRACT]),
      ),
      role: userRoles.SENIOR,
      contractCompletedOn: getYYYYMMDDString(),
    };

    const clinicalData = {
      ...row.clinical,
      userId: row.userId,
      status: row.clinical?.status || "In Home",
    };

    const crmPayload = {
      data: omit(crmData, USER_PATH_OMIT_FIELDS),
      path: UserPath,
    };
    const clinicalPayload = {
      data: omit(clinicalData, CLINICAL_USER_PATH_OMIT_FIELDS),
      path: ClinicalUserPath,
    };

    mutate(clinicalPayload, {
      onSuccess: () => {
        mutate(crmPayload, {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Senior Lead moved to clincial!"),
            );
            router.push("/clinical");
            closeMenu();
          },
          onError: (error: any) => {
            const apiError = error?.response?.data?.error;
            const errorMessage =
              !Array.isArray(apiError) && apiError
                ? apiError
                : "CRM update failed";
            if (error?.response?.status === 409) {
              showConfirmError(errorMessage);
              return;
            }
            closeMenu();
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage(errorMessage));
            dispatch(handleShowCloseOptions());
          },
        });
      },
      onError: (error: any) => {
        const apiError = error?.response?.data?.error;
        const errorMessage =
          !Array.isArray(apiError) && apiError
            ? apiError
            : "Clinical update failed";
        if (error?.response?.status === 409) {
          showConfirmError(errorMessage);
          return;
        }
        closeMenu();
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage(errorMessage));
        dispatch(handleShowCloseOptions());
      },
    });
  };

  async function verifySeniorDocuments() {
    const docs = (row as any)?.documents || [];

    // 1. Filter required onboarding docs
    const requiredOnboardingDocs = docs.filter(
      (doc: any) =>
        doc.documentCategory === DocumentCategory.ON_BOARDING &&
        doc.isRequiredDocument === true,
    );
    // If no required onboarding docs are defined, treat as failure or success
    // depending on your business rule. I'm keeping your old shape:
    if (!requiredOnboardingDocs?.length) {
      return {
        success: false,
        missingFiles: ["No required onboarding documents configured."],
      };
    }

    const missingFiles: string[] = [];

    for (const doc of requiredOnboardingDocs) {
      const name = doc.documentName;

      // Placeholders flow removed: uploaded == complete
      if (!doc?.documentUrl) {
        missingFiles.push(name);
      }
    }

    if (missingFiles?.length) {
      return { success: false, missingFiles };
    }

    return { success: true };
  }

  const handleInitiateESign = async (closeMenu: () => void) => {
    // Prepare data for e-sign initiation
    const DataForESign = {
      homeId: LoggedInUserhomeId,
      senderUserId: userId,
      recipientUserId: row?.userId,
    };

    const payloadDataForDocuSign = {
      userData: DataForESign,
      path: docuSignPath,
    };

    createMutate(payloadDataForDocuSign, {
      onSuccess: (response) => {
        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            "E-sign initiated. Check dashboard for details.",
          ),
        );
        closeMenu();
      },
      onError: (error: any) => {
        let errorMessage = "Error in initiating e-sign. Please try again.";
        if (error?.response?.data?.error === "File not found") {
          errorMessage = "Please edit all documents before starting e-sign.";
        } else if (
          error?.response?.data?.error === "Recipient email does not exist"
        ) {
          errorMessage =
            "E-sign cannot be initiated without a recipient email.";
        } else if (
          error?.response?.data?.error === "Contract is already sent and signed"
        ) {
          errorMessage = "This contract has already been signed.";
        } else if (
          error?.response?.data?.error ===
          "Required contract files are missing in S3"
        ) {
          errorMessage =
            "Please edit all the files before initiating e-sign.";
        } else {
          errorMessage = "Error in initiating e-sign. Please try again.";
        }
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errorMessage));
        closeMenu();
      },
    });
  };

  return (
    <MenuIconChild
      onRegisterLead={handleRegisterLead}
      onCompleteContract={handleCompleteContract}
      onInitiateESign={handleInitiateESign}
      verifyDocuments={verifySeniorDocuments}
      canEdit={hasAccess(role as Role, "CRM_ACTIONS", "EDIT")}
      data={row}
      hasClinical={hasClinical}
    />
  );
};

export default LeadActionsCell;

interface MenuIconChildProps {
  onRegisterLead: (closeMenu: () => void) => void;
  onCompleteContract: (
    closeMenu: () => void,
    showConfirmError: (message: string) => void,
  ) => void;
  onInitiateESign?: (closeMenu: () => void) => void;
  data?: PCGLeadRow;
  verifyDocuments: () => Promise<{ success: boolean; missingFiles?: string[] }>;
  canEdit: boolean;
  hasClinical: boolean;
}
const MenuIconChild: React.FC<MenuIconChildProps> = ({
  onRegisterLead,
  onCompleteContract,
  onInitiateESign,
  verifyDocuments,
  canEdit,
  data,
  hasClinical,
}) => {
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<
    "register" | "contract" | "initiateESign" | "deleteLead" | "markAsLost" | null
  >(null);
  const [selectedLostCategory, setSelectedLostCategory] = useState<string>("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const { mutate: updateMutate } = useUpdate();
  const dispatch = useDispatch();
  const { mutate: deleteUserMutate } = useDelete();

  // we'll get isPending from props via closure
  const [isLoading, setIsLoading] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setShowConfirm(false);
    setActionType(null);
    setConfirmError(null);
    setIsLoading(false);
  };
  const setConfirmOpen = (open: boolean) => {
    setShowConfirm(open);
    if (!open) setConfirmError(null);
  };

  const showPopover = (message: string) => {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowPopoverMessage(message));
  };
  const handleConfirm = async () => {
    if (actionType === "register") {
      onRegisterLead(closeMenu);
    } else if (actionType === "contract") {
      setIsLoading(true);
      onCompleteContract(closeMenu, (msg) => {
        setIsLoading(false);
        setConfirmError(msg);
      });
    } else if (actionType === "initiateESign") {
      if (!data?.email) {
        showPopover("E-sign cannot be initiated without a recipient email.");
        closeMenu();
        return;
      }

      if (
        data?.docusignEnvelopeStatus === ESIGN_ENVELOPE_STATUS_COMPLETED ||
        data?.onboardingESignEnvelopeStatus === ESIGN_ENVELOPE_STATUS_COMPLETED
      ) {
        showPopover("This contract has already been signed.");
        closeMenu();
        return;
      }

      // set loading true before calling
      setIsLoading(true);
      const startTime = Date.now();
      // Validate required documents
      // const result = await verifyDocuments();
      // if (!result.success) {
      //   setIsLoading(false);
      //   showPopover("Please edit all documents before starting e-sign.");
      //   closeMenu();
      //   return;
      // }

      onInitiateESign(() => {
        // close after API finishes
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 2000 - elapsed); // enforce 5s minimum

        setTimeout(() => {
          setIsLoading(false);
          closeMenu();
        }, remaining);
      });
    } else if (actionType === "markAsLost") {
      if (!selectedLostCategory) {
        showPopover("Please select a lost category.");
        return;
      }
      const updateData = omit(
        {
          ...data,
          milestone: [...(data.milestone || []), milestones.LOST],
          lostCategory: selectedLostCategory,
        },
        USER_PATH_OMIT_FIELDS
      );
      updateMutate(
        { data: updateData, path: UserPath },
        {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Senior Lead marked as lost."),
            );
            closeMenu();
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to mark Senior Lead as lost.",
              ),
            );
            closeMenu();
          },
        },
      );
    } else if (actionType === "deleteLead") {
      const path = UserPath;
      const leadId = data?.userId;
      deleteUserMutate(
        { id: leadId, path },
        {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Senior Lead deleted successfully!"),
            );
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to delete Senior Lead.",
              ),
            );
          },
        },
      );
      setShowConfirm(false);
    }
  };
  const isLeadOnBoarded = data?.lastLoginTimestamp;
  const isSalesRequired = getIsSalesRequiredFromCookie() ?? false;

  return (
    <>
      <PopoverComponent
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        body={
          <div className="w-[140px]">
            {hasAccess(role as Role, "CRM_ACTIONS", "EDIT") && (
              <>
                {!data?.milestone?.includes(milestones.LOST) && (
                  <>
                    {hasAccess(role as Role, "CRM_ONBOARD_LEAD", "EDIT") && (
                      <div
                        className={`p-[5px] hover:rounded-md font-poppins ${
                          isLeadOnBoarded
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-lightgray"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLeadOnBoarded) return;

                          setActionType("register");
                          setIsMenuOpen(false);
                          setConfirmError(null);
                          setShowConfirm(true);
                        }}
                      >
                        Onboard
                      </div>
                    )}
                    {hasClinical && hasAccess(role as Role, "CRM_MOVE_TO_CLINICAL", "EDIT") && (
                      <div
                        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                        onClick={() => {
                          setActionType("contract");
                          setIsMenuOpen(false);
                          setConfirmError(null);
                          setShowConfirm(true);
                        }}
                      >
                        Move to Clinical
                      </div>
                    )}
                    {hasAccess(role as Role, "CRM_INITIATE_ESIGN", "EDIT") && (
                      <div
                        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                        onClick={() => {
                          setActionType("initiateESign");
                          setIsMenuOpen(false);
                          setConfirmError(null);
                          setShowConfirm(true);
                        }}
                      >
                        Initiate e-sign
                      </div>
                    )}
                    {hasAccess(role as Role, "CRM_MARK_AS_LOST", "EDIT") && isSalesRequired && (
                      <div
                        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                        onClick={() => {
                          setActionType("markAsLost");
                          setSelectedLostCategory(data?.lostCategory || "");
                          setIsMenuOpen(false);
                          setConfirmError(null);
                          setShowConfirm(true);
                        }}
                      >
                        Lost
                      </div>
                    )}
                  </>
                )}
                {hasAccess(role as Role, "CRM_DELETE_LEAD", "EDIT") && (
                  <div
                    className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                    onClick={() => {
                      setActionType("deleteLead");
                      setIsMenuOpen(false);
                      setShowConfirm(true);
                    }}
                  >
                    Delete
                  </div>
                )}
              </>
            )}
          </div>
        }
      >
        <MenuIcon />
      </PopoverComponent>

      {/* Confirmation Modal */}
      <CommonModal
        title={
          confirmError
            ? "Home Capacity Reached!"
            : actionType === "register"
              ? "Onboard Lead"
              : actionType === "contract"
                ? "Move to Clinical"
                : actionType === "initiateESign"
                  ? "Initiate e-Sign"
                  : actionType === "markAsLost"
                    ? "Mark as Lost"
                    : actionType === "deleteLead"
                      ? "Delete Lead"
                      : ""
        }
        modalOpen={showConfirm}
        setModalOpen={setConfirmOpen}
        crossCTA={true}
      >
        <div className="font-poppins min-w-[450px] px-[20px]">
          <div className="mb-4">
            {confirmError ? (
              <>
                <div className="text-sm text-gray-700 whitespace-pre-line text-center">
                  {confirmError.replace(/\\n/g, "\n")}
                </div>
                <div className="mt-4 text-center">
                  <a
                    href="#"
                    className="text-sm text-primary underline"
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmOpen(false);
                      dispatch(handleOpenSupportModal());
                    }}
                  >
                    Contact Support
                  </a>
                </div>
              </>
            ) : actionType === "register" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to onboard this Senior Lead?
                <hr />
                <div>
                  <strong>Note:</strong> An email will be sent to the Senior
                  Lead for onboarding.
                </div>
              </div>
            ) : actionType === "contract" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to move this Senior Lead to clinical?
                <hr />
                <div>
                  <strong>Note:</strong> Lead will be pushed to the clinical
                  dashboard.
                </div>
              </div>
            ) : actionType === "initiateESign" ? (
              !isLoading ? (
                <div className="text-sm text-gray-700 mb-4">
                  Are you sure you want to initiate e-sign for this Senior Lead?
                  <hr />
                  <div>
                    <span className="font-bold">Note :</span>
                    <ul className="list-decimal ml-2 mt-1">
                      <li>
                        You must edit all documents before initiating e-sign.
                      </li>
                      <li>
                        An email will be sent to the Senior Lead to complete the
                        e-sign process.
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div>
                  <strong>Note:</strong> Initiating… this may take up to 1
                  minute
                </div>
              )
            ) : actionType === "markAsLost" ? (
              <div className="text-sm text-gray-700 mb-4">
                <p className="mb-3">Please select a reason for marking this lead as lost:</p>
                <div className="flex flex-col gap-2">
                  {lostCategoryOptions.map((category) => (
                    <label
                      key={category}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border ${
                        selectedLostCategory === category
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="lostCategory"
                        value={category}
                        checked={selectedLostCategory === category}
                        onChange={(e) => setSelectedLostCategory(e.target.value)}
                        className="accent-blue-500"
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : actionType === "deleteLead" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to permanently delete this Senior Lead?
              </div>
            ) : null}
          </div>

          {/* Show spinner when loading */}
          {confirmError ? null : isLoading ? (
            <div className="flex justify-center items-center py-4">
              <TailSpin
                height={50}
                width={50}
                color="#6B7280" // Tailwind's gray-500 hex value
                strokeWidth="4px"
              />
            </div>
          ) : (
            <div className="flex justify-center gap-6">
              <Button
                name="Confirm"
                classname="bg-green-500 text-white"
                titleClass="!text-[14px]"
                buttonClick={handleConfirm}
              />
              <Button
                name="Cancel"
                classname="bg-gray-300 text-black"
                titleClass="!text-[14px]"
                buttonClick={() => setConfirmOpen(false)}
              />
            </div>
          )}
        </div>
      </CommonModal>
    </>
  );
};