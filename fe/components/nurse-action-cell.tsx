'use client'
import React, { useContext, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import useAuthenticateUser from "../services/authenticate-user";
import useUpdate from "../services/update";
import {
  UserPath,
  userSignUpPath,
  userRoles,
  docuSignPath,
  ESIGN_ENVELOPE_STATUS_COMPLETED,
  USER_PATH_OMIT_FIELDS,
  CLINICAL,
  DocumentCategory,
} from "../utils/constants";
import {
  handleOpenPopover,
  handleShowPopoverMessage,
  handleShowCloseOptions,
} from "../redux/slices/exception-popover-slice";
import { RoleContext } from "./role-provider";
import { hasAccess } from "../utils/roleAccess";
import { Role } from "../utils/roles";
import MenuIcon from "../public/icons/menu-icon";
import PopoverComponent from "../commonComponents/popover-component";
import CommonModal from "../commonComponents/common-modal";
import Button from "../commonComponents/button";
import { omit } from "lodash";
import { getYYYYMMDDString } from "../utils/dateUtils";
import useCreate from "../services/create";
import { TailSpin } from "react-loader-spinner";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../utils/auth";
import useDelete from "../services/delete";
import { useAuthorizedModules } from "../utils/useAuthorizedModules";
import fetchPreSignedUrl from "../services/get-presigned-url";
import AssignSeniorsModal from "./nurse/assign-seniors-modal";

export interface NurseLeadRow {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  isDeleted?: boolean;
  documents?: Array<{
    documentId: string;
    documentType: string;
    documentName: string;
    documentUrl: string;
    createdByUserId: string;
    createdAt: string;
  }>;
  [key: string]: any;
}

// Action menu for Nurse Lead/Nurse rows.
// Mirrors PCG action menu: onboard, move to clinical, initiate e-sign, delete.
const NurseActionsCell: React.FC<{ row: NurseLeadRow; classname: string }> = ({
  row,
  classname,
}) => {
  const dispatch = useDispatch();
  const router = useRouter();

  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const loggedInUserId = getUserIdFromToken();
  const loggedInUserHomeId = getHomeIdFromToken();

  const authenticateUser = useAuthenticateUser();
  const { mutate } = useUpdate();
  const { mutate: createMutate } = useCreate();

  const authorizedModules = useAuthorizedModules();
  const hasClinical = authorizedModules.includes(CLINICAL.toUpperCase());

  // Sends onboarding email to the Nurse Lead.
  const handleRegisterNurse = (closeMenu: () => void) => {
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

  // Moves Nurse Lead record to Nurse (Clinical).
  const handleCompleteContract = (closeMenu: () => void) => {
    const crmData = {
      ...row,
      role: userRoles.NURSE,
      contractCompletedOn: getYYYYMMDDString(),
    };

    const cleanedCRMData: any = omit(crmData, USER_PATH_OMIT_FIELDS);
    const crmPayload = { data: cleanedCRMData, path: UserPath };

    mutate(crmPayload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Nurse Lead moved to clinical!"));
        router.push("/clinical/nurse");
        closeMenu();
      },
      onError: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage("Not able to complete contract! try again later!"),
        );
        closeMenu();
      },
    });
  };

  // Ensures required onboarding documents exist and are fully edited (no placeholders in DOCX).
  async function verifyDocumentsForNurse() {
    const docs = (row as any)?.documents || [];

    const requiredOnboardingDocs = docs.filter(
      (doc: any) =>
        doc.documentCategory === DocumentCategory.ON_BOARDING &&
        doc.isRequiredDocument === true,
    );

    if (!requiredOnboardingDocs?.length) {
      return {
        success: false,
        missingFiles: ["No required onboarding documents configured."],
      };
    }

    const missingFiles: string[] = [];

    for (const doc of requiredOnboardingDocs) {
      const name = doc.documentName;

      const isDocxLike =
        doc.documentType === ".doc" ||
        doc.documentType === ".docx" ||
        doc.documentType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (isDocxLike) {
        const enabled = !!doc.documentUrl;
        if (!enabled) return;

        try {
          const presignedUrl = await fetchPreSignedUrl(doc.documentUrl);
          // const hasPlaceholders = await docxHasPlaceholders(presignedUrl);
          // if (hasPlaceholders) {
          //   missingFiles.push(name);
          // }
        } catch (err) {
          console.error("Error checking placeholders for doc:", name, err);
          missingFiles.push(name);
        }
      }
    }

    if (missingFiles?.length) {
      return { success: false, missingFiles };
    }

    return { success: true };
  }

  // Initiates e-sign for the Nurse Lead.
  const handleInitiateESign = async (closeMenu: () => void) => {
    const dataForESign = {
      homeId: loggedInUserHomeId,
      senderUserId: loggedInUserId,
      recipientUserId: row?.userId,
    };

    const payloadDataForDocuSign = {
      userData: dataForESign,
      path: docuSignPath,
    };

    createMutate(payloadDataForDocuSign, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("E-sign initiated. Check dashboard for details."));
        closeMenu();
      },
      onError: (error: any) => {
        let errorMessage = "Error in initiating e-sign. Please try again.";
        if (error?.response?.data?.error === "File not found") {
          errorMessage = "Please edit all documents before starting e-sign.";
        } else if (error?.response?.data?.error === "Recipient email does not exist") {
          errorMessage = "E-sign cannot be initiated without a recipient email.";
        } else if (error?.response?.data?.error === "Contract is already sent and signed") {
          errorMessage = "This contract has already been signed.";
        }

        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errorMessage));
        closeMenu();
      },
    });
  };

  return (
    <div className={`${classname}`}>
      <MenuIconChild
        onRegisterNurse={handleRegisterNurse}
        onCompleteContract={handleCompleteContract}
        onInitiateESign={handleInitiateESign}
        verifyDocuments={verifyDocumentsForNurse}
        canEdit={hasAccess(role as Role, "CRM_ACTIONS", "EDIT")}
        data={row}
        hasClinical={hasClinical}
      />
    </div>
  );
};

export default NurseActionsCell;

interface MenuIconChildProps {
  onRegisterNurse: (closeMenu: () => void) => void;
  onCompleteContract: (closeMenu: () => void) => void;
  onInitiateESign: (closeMenu: () => void) => void;
  verifyDocuments: () => Promise<{ success: boolean; missingFiles?: string[] }>;
  canEdit: boolean;
  data?: NurseLeadRow;
  hasClinical: boolean;
}

// Renders the popover menu and confirm modal.
const MenuIconChild: React.FC<MenuIconChildProps> = ({
  onRegisterNurse,
  onCompleteContract,
  onInitiateESign,
  verifyDocuments,
  canEdit,
  data,
  hasClinical,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAssignSeniors, setShowAssignSeniors] = useState(false);
  const [actionType, setActionType] = useState<
    | "registerNurse"
    | "completeContract"
    | "initiateESign"
    | "assignSeniors"
    | "deleteNurseLead"
    | null
  >(null);

  const dispatch = useDispatch();
  const { mutate: deleteUserMutate } = useDelete();

  const [isLoading, setIsLoading] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setShowConfirm(false);
    setShowAssignSeniors(false);
    setActionType(null);
    setIsLoading(false);
  };

  const showPopover = (message: string) => {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowPopoverMessage(message));
  };

  // Handles the selected action after user confirmation.
  const handleConfirm = async () => {
    if (actionType === "registerNurse") {
      onRegisterNurse(closeMenu);
      return;
    }

    if (actionType === "completeContract") {
      onCompleteContract(closeMenu);
      return;
    }

    if (actionType === "initiateESign") {
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

      setIsLoading(true);
      const startTime = Date.now();

      // const result = await verifyDocuments();
      // if (!result.success) {
      //   showPopover("Please edit all documents before starting e-sign.");
      //   closeMenu();
      //   return;
      // }

      onInitiateESign(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 2000 - elapsed);

        setTimeout(() => {
          setIsLoading(false);
          closeMenu();
        }, remaining);
      });
      return;
    }

    if (actionType === "deleteNurseLead") {
      const path = UserPath;
      const nurseLeadId = data?.userId;

      deleteUserMutate(
        { id: nurseLeadId, path },
        {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Nurse Lead deleted successfully!"));
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to delete Nurse Lead.",
              ),
            );
          },
        },
      );

      setShowConfirm(false);
    }
  };

  const isLeadOnBoarded = data?.lastLoginTimestamp;
  const router = useRouter();
  const isClinical = router?.pathname?.startsWith("/clinical");

  return (
    <div>
      <PopoverComponent
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        body={
          <div className="w-[140px]">
            {canEdit && (
              <div>
                <div
                  className={`p-[5px] hover:rounded-md font-poppins ${
                    isLeadOnBoarded
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-lightgray"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLeadOnBoarded) return;
                    setActionType("registerNurse");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Onboard
                </div>

                {data?.role === userRoles.NURSELEAD && hasClinical && (
                  <div>
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                      onClick={() => {
                        setActionType("completeContract");
                        setIsMenuOpen(false);
                        setShowConfirm(true);
                      }}
                    >
                      Move to Clinical
                    </div>
                  </div>
                )}

                {/* <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("initiateESign");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Initiate e-sign
                </div> */}

                {isClinical && (
                  <div
                    className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                    onClick={() => {
                      setActionType("assignSeniors");
                      setIsMenuOpen(false);
                      setShowAssignSeniors(true);
                    }}
                  >
                    Assign Seniors
                  </div>
                )}

                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("deleteNurseLead");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Delete
                </div>
              </div>
            )}
          </div>
        }
      >
        <MenuIcon />
      </PopoverComponent>

      {showAssignSeniors && (
        <AssignSeniorsModal
          isOpen={showAssignSeniors}
          setIsOpen={setShowAssignSeniors}
          nurse={data || {}}
        />
      )}

      <CommonModal
        title={
          actionType === "registerNurse"
            ? "Onboard Nurse Lead"
            : actionType === "completeContract"
              ? "Move Nurse Lead to Clinical"
              : actionType === "initiateESign"
                ? "Initiate e-Sign"
                : actionType === "deleteNurseLead"
                  ? "Delete Nurse Lead"
                  : ""
        }
        modalOpen={showConfirm}
        setModalOpen={setShowConfirm}
        crossCTA
      >
        <div className="font-poppins px-[20px]">
          <div className="mb-4">
            {actionType === "registerNurse" ? (
              <div className="font-poppins text-sm text-gray-700 mb-4">
                Are you sure you want to onboard this Nurse Lead?
                <hr />
                <div>
                  <strong>Note:</strong> An email will be sent to the Nurse Lead for onboarding.
                </div>
              </div>
            ) : actionType === "completeContract" ? (
              <div className="font-poppins text-sm text-gray-700 mb-4">
                Are you sure you want to move Nurse Lead to clinical?
                <hr />
                <div>
                  <strong>Note:</strong> The Nurse Lead will be moved forward in the clinical dashboard.
                </div>
              </div>
            ) : actionType === "initiateESign" ? (
              !isLoading ? (
                <div className="font-poppins text-sm text-gray-700 mb-4">
                  Are you sure you want to initiate e-sign for this Nurse Lead?
                  <hr />
                  <div>
                    <span className="font-bold">Note :</span>
                    <ul className="list-decimal ml-2 mt-1">
                      <li>You must edit all documents before initiating e-sign.</li>
                      <li>An email will be sent to the Nurse Lead to complete the e-sign process.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div>
                  <strong>Note:</strong> Initiating… this may take up to 1 minute
                </div>
              )
            ) : actionType === "deleteNurseLead" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to permanently delete this Nurse Lead?
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-4">
              <TailSpin height={50} width={50} color="#6B7280" strokeWidth="4px" />
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