"use client";
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
  onboardingDocsForPCG,
  USER_PATH_OMIT_FIELDS,
  homePath,
  accessAllModules,
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
import { has, omit } from "lodash";
import { getYYYYMMDDString } from "../utils/dateUtils";
import useCreate from "../services/create";
import { TailSpin } from "react-loader-spinner";
import { checkRequiredFilesInS3 } from "../utils/s3Client";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../utils/auth";
import useDelete from "../services/delete";
import { useAuthorizedModules } from "../utils/useAuthorizedModules";
import fetchPreSignedUrl from "../services/get-presigned-url";

// Type this to your actual PCG lead/user shape if you have one handy.
export interface PCGLeadRow {
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

const PCGActionsCell: React.FC<{ row: PCGLeadRow; classname: string }> = ({
  row,
  classname,
}) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const LoggedInuserId = getUserIdFromToken();
  const LoggedInUserhomeId = getHomeIdFromToken();

  const authenticateUser = useAuthenticateUser();
  const { mutate } = useUpdate();
  const { mutate: createMutate } = useCreate();

  const authorizedModules = useAuthorizedModules();

  const hasClinical = authorizedModules.includes(CLINICAL.toUpperCase());

  const handleRegisterPCG = (closeMenu: () => void) => {
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
    closeMenu: () => void
  ) => {
    const crmData = {
      ...row,
      role: userRoles.PCG,
      contractCompletedOn: getYYYYMMDDString(),
    };

    const cleanedCRMData: any = omit(crmData, USER_PATH_OMIT_FIELDS);

    const crmPayload = { data: cleanedCRMData, path: UserPath };

    mutate(crmPayload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Care Lead moved to clinical!"));
        router.push("/clinical/pcg");
        closeMenu();
      },
      onError: () => {
        dispatch(handleOpenPopover()),
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Not able to complete contract! try again later!",
          ),
        );
        closeMenu();
      },
    });
  };

  async function verifyDocumentsForPCG() {
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
    // Prepare data for  e-sign initiation
    const DataForESign = {
      homeId: LoggedInUserhomeId,
      senderUserId: LoggedInuserId,
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
    <div className={`${classname}`}>
      <MenuIconChild
        onRegisterPCG={handleRegisterPCG}
        onCompleteContract={handleCompleteContract}
        onInitiateESign={handleInitiateESign}
        verifyDocuments={verifyDocumentsForPCG}
        canEdit={hasAccess(role as Role, "CRM_ACTIONS", "EDIT")}
        data={row}
        hasClinical={hasClinical}
      />
    </div>
  );
};

export default PCGActionsCell;

interface MenuIconChildProps {
  onRegisterPCG: (closeMenu: () => void) => void;
  onCompleteContract: (closeMenu: () => void) => void;
  onInitiateESign: (closeMenu: () => void) => void;
  verifyDocuments: () => Promise<{ success: boolean; missingFiles?: string[] }>;
  canEdit: boolean;
  data?: PCGLeadRow;
  hasClinical: boolean;
}

const MenuIconChild: React.FC<MenuIconChildProps> = ({
  onRegisterPCG,
  onCompleteContract,
  onInitiateESign,
  verifyDocuments,
  canEdit,
  data,
  hasClinical,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<
    | "registerPCG"
    | "completeContract"
    | "initiateESign"
    | "deletePCGLead"
    | null
  >(null);
  const dispatch = useDispatch();
  const { mutate: deleteUserMutate } = useDelete();
  const role = getUserRoleFromToken();

  // we'll get isPending from props via closure
  const [isLoading, setIsLoading] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setShowConfirm(false);
    setActionType(null);
    setIsLoading(false);
  };

  const showPopover = (message: string) => {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowPopoverMessage(message));
  };

  const handleConfirm = async () => {
    if (actionType === "registerPCG") {
      onRegisterPCG(closeMenu);
    } else if (actionType === "completeContract") {
      onCompleteContract(closeMenu);
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

      // const result = await verifyDocuments();
      // if (!result.success) {
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
    } else if (actionType === "deletePCGLead") {
      const path = UserPath;
      const PCGLeadId = data?.userId;
      deleteUserMutate(
        { id: PCGLeadId, path },
        {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage(
                `${data?.role == "PCGLead" ? "Care Lead " : "Care Team "} deleted successfully!`,
              ),
            );
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to delete Care Lead.",
              ),
            );
          },
        },
      );
      setShowConfirm(false);
    }
  };
  const isLeadOnBoarded = data?.lastLoginTimestamp;
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
                    setActionType("registerPCG");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Onboard
                </div>
                {data?.role === userRoles.PCGLEAD && hasClinical && (
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
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("initiateESign");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Initiate e-sign
                </div>
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("deletePCGLead");
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

      <CommonModal
        title={
          actionType === "registerPCG"
              ? `Onboard ${data?.role == "PCGLead" ? "Care Lead " : "Care Team "}`
              : actionType === "completeContract"
                ? `Move ${
                    data?.role == "PCGLead" ? "Care Lead " : "Care Team "
                  } to Clinical`
                : actionType === "initiateESign"
                  ? "Initiate e-Sign"
                  : actionType === "deletePCGLead"
                    ? data?.role === userRoles?.PCG
                      ? "Delete Care Team"
                      : "Delete Care Lead"
                    : ""
        }
        modalOpen={showConfirm}
        setModalOpen={setShowConfirm}
        crossCTA
      >
        <div className="font-poppins px-[20px]">
          <div className="mb-4">
            {actionType === "registerPCG" ? (
              <div className="font-poppins text-sm text-gray-700 mb-4">
                Are you sure you want to onboard this{" "}
                {data?.role == "PCGLead" ? "Care Lead " : "Care Team "}?
                <hr />
                <div>
                  <strong>Note:</strong> An email will be sent to the{" "}
                  {data?.role == "PCGLead" ? "Care Lead " : "Care Team "} for
                  onboarding.
                </div>
              </div>
            ) : actionType === "completeContract" ? (
              <div className="font-poppins text-sm text-gray-700 mb-4">
                Are you sure you want to move{" "}
                {data?.role == "PCGLead" ? "Care Lead " : "Care Team "} to
                clinical?
                <hr />
                <div>
                  <strong>Note:</strong> The{" "}
                  {data?.role == "PCGLead" ? "Care Lead " : "Care Team "} will
                  be moved forward in the clinical dashboard.
                </div>
              </div>
            ) : actionType === "initiateESign" ? (
              !isLoading ? (
                <div className="font-poppins text-sm text-gray-700 mb-4">
                  Are you sure you want to initiate e-sign for this{" "}
                  {data?.role == "PCGLead" ? "Care Lead " : "Care Team "}?
                  <hr />
                  <div>
                    <span className="font-bold">Note :</span>
                    <ul className="list-decimal ml-2 mt-1">
                      <li>
                        You must edit all documents before initiating e-sign.
                      </li>
                      <li>
                        An email will be sent to the{" "}
                        {data?.role === "PCGLead" ? "Care Lead" : "Care Team"}
                        to complete the e-sign process.
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
            ) : actionType === "deletePCGLead" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to
                {data?.role === userRoles?.PCG
                  ? " delete this Care Team"
                  : " permanently delete this Care Lead"}
                ?
              </div>
            ) : null}
          </div>

          {/* Show spinner when loading */}
          {isLoading ? (
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
                buttonClick={() => setShowConfirm(false)}
              />
            </div>
          )}
        </div>
      </CommonModal>
    </div>
  );
};