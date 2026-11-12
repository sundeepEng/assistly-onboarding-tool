"use client";
import React, { useContext, useEffect, useState } from "react";
import PopoverComponent from "../commonComponents/popover-component";
import MenuIcon from "../public/icons/menu-icon";
import { useRouter } from "next/router";
import { handleOpenAddMedicationModal } from "../redux/slices/modal-slice";

import { useAppDispatch } from "../redux/hooks";
import { RoleContext } from "./role-provider";
import { Role } from "../utils/roles";
import { ProtectedComponent } from "./protectedComponent";

import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import {
  DocumentCategory,
  ESIGN_ENVELOPE_STATUS_COMPLETED,
  docuSignPath,
  INITIATE_E_SIGN,
  onboardingDocsForSeniors,
  UserPath,
  userSignUpPath,
} from "../utils/constants";
import useAuthenticateUser from "../services/authenticate-user";
import CommonModal from "../commonComponents/common-modal";
import Button from "../commonComponents/button";
import { TailSpin } from "react-loader-spinner";
import useCreate from "../services/create";
import { checkRequiredFilesInS3 } from "../utils/s3Client";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../utils/auth";
import useDelete from "../services/delete";
import fetchPreSignedUrl from "../services/get-presigned-url";

interface SeniorActionsProps {
  className?: string;
  data?: any;
  userId: string;
}

const SeniorActions: React.FC<SeniorActionsProps> = ({
  className,
  data,
  userId,
}) => {
  const dispatch = useAppDispatch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const router = useRouter();
  const authenticateUser = useAuthenticateUser();
  const { mutate: deleteUserMutate } = useDelete();

  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<
    "initiateESign" | "deleteSenior" | ""
  >();
  const { mutate: createMutate } = useCreate();
  const LoggedInUserhomeId = getHomeIdFromToken();
  const LoggedInUserId = getUserIdFromToken();

  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole, router]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setActionType(null);
    setIsLoading(false);
    setShowConfirm(false);
  };

  const handleOnboard = (closeMenu: () => void) => {
    const row = data;
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

  const handleAddMed = (closeMenu: () => void) => {
    router.push(`/clinical/${userId}?activeTab=${"Medication"}`);
    if (router.isReady) {
      dispatch(handleOpenAddMedicationModal());
    }
    closeMenu();
  };

  const handleMedPass = (closeMenu: () => void) => {
    router.push(`/clinical/${userId}?activeTab=${"MedPass"}`);
    closeMenu();
  };

  const handleIncidentReport = (closeMenu: () => void) => {
    router.push(`/clinical/${userId}?activeTab=${"Incident Report"}`);
    closeMenu();
  };

  const handleESign = (closeMenu: () => void) => {
    setActionType("initiateESign");
    setShowConfirm(true);
    closeMenu();
  };

  async function verifySeniorDocuments() {
    const docs = (data as any)?.documents || [];

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
      senderUserId: LoggedInUserId,
      recipientUserId: data?.userId,
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

  // Helper function for showing popover
  const showPopover = (message: string) => {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowPopoverMessage(message));
  };

  const handleConfirm = async () => {
    if (actionType === "initiateESign") {
      // Validate email
      if (!data?.email) {
        showPopover("E-sign cannot be initiated without a recipient email.");
        closeMenu();
        return;
      }

      // Validate contract status
      if (
        data?.docusignEnvelopeStatus === ESIGN_ENVELOPE_STATUS_COMPLETED ||
        data?.onboardingESignEnvelopeStatus === ESIGN_ENVELOPE_STATUS_COMPLETED
      ) {
        showPopover("This contract has already been signed.");
        closeMenu();
        return;
      }

      // Now we are ready to initiate E-Sign
      setIsLoading(true); // Only set loading here
      const startTime = Date.now();

      // Validate required documents
      const result = await verifySeniorDocuments();
      if (!result.success) {
        showPopover("Please edit all documents before starting e-sign.");
        closeMenu();
        return;
      }

      handleInitiateESign(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 2000 - elapsed); // enforce 2s minimum
        setTimeout(() => {
          setIsLoading(false);
          closeMenu();
        }, remaining);
      });
    }
    if (actionType === "deleteSenior") {
      handleDeleteSenior();
      setShowConfirm(false);
    }
  };

  const handleDeleteSenior = () => {
    const path = UserPath;
    const seniorId = userId;
    deleteUserMutate(
      { id: seniorId, path },
      {
        onSuccess: (response) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Senior deleted successfully!"));
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              !Array?.isArray(error?.response?.data?.error)
                ? error?.response?.data?.error
                : "Failed to delete Senior.",
            ),
          );
        },
      },
    );
    // setShowConfirm(false)
  };
  const isLeadOnBoarded = data?.lastLoginTimestamp;
  return (
    <div className={className}>
      <PopoverComponent
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        body={
          <div className="w-[140px]">
            <>
              <ProtectedComponent
                role={role as Role}
                feature={"CLINICAL_TABS_QUICK_ACTIONS"}
                access={"EDIT"}
              >
                <div
                  className={`p-[5px] hover:rounded-md font-poppins ${
                    isLeadOnBoarded
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-lightgray"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLeadOnBoarded) return;
                    handleOnboard(closeMenu);
                  }}
                >
                  Onboard
                </div>
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    handleAddMed(closeMenu);
                  }}
                >
                  Add Medication
                </div>
              </ProtectedComponent>

              <div
                className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                onClick={() => {
                  handleMedPass(closeMenu);
                }}
              >
                MedPass
              </div>
              <ProtectedComponent
                role={role as Role}
                feature={"CLINICAL_TABS_QUICK_ACTIONS_INCIDENT_REPORT"}
                access={"EDIT"}
              >
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    handleIncidentReport(closeMenu);
                  }}
                >
                  Incident Report
                </div>
              </ProtectedComponent>
              <ProtectedComponent
                role={role as Role}
                feature={"CLINICAL_TABS_QUICK_ACTIONS"}
                access={"EDIT"}
              >
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("initiateESign");
                    setShowConfirm(true);
                  }}
                >
                  Initiate e-sign
                </div>
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("deleteSenior");
                    setShowConfirm(true);
                  }}
                >
                  Delete
                </div>
              </ProtectedComponent>
            </>
          </div>
        }
      >
        <MenuIcon />
      </PopoverComponent>
      {/* CommonModal for E-sign confirmation */}
      <CommonModal
        title={
          actionType === INITIATE_E_SIGN
            ? "Initiate e-Sign"
            : actionType === "deleteSenior"
              ? "Delete Senior "
              : ""
        }
        modalOpen={showConfirm}
        setModalOpen={setShowConfirm}
        crossCTA
      >
        <div className="font-poppins px-[20px]">
          <div className="mb-4">
            {actionType === "initiateESign" ? (
              !isLoading ? (
                <div className="font-poppins text-sm text-gray-700 mb-4">
                  Are you sure you want to initiate e-sign for this Senior?
                  <hr />
                  <div>
                    <span className="font-bold">Note :</span>
                    <ul className="list-decimal ml-2 mt-1">
                      <li>
                        You must edit all documents before initiating e-sign.
                      </li>
                      <li>
                        An email will be sent to the Senior to complete the
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
            ) : actionType === "deleteSenior" ? (
              <div>Are you sure you want to delete Senior ?</div>
            ) : null}
          </div>
          {/* Show spinner when loading */}
          {isLoading ? (
            <div className="flex justify-center items-center py-4">
              <TailSpin
                height={50}
                width={50}
                color="#6B7280"
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
                buttonClick={() => setShowConfirm(false)}
              />
            </div>
          )}
        </div>
      </CommonModal>
    </div>
  );
};

export default SeniorActions;