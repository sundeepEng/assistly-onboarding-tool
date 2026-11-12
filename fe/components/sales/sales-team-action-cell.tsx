"use client";
import React, { useContext, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import useAuthenticateUser from "../../services/authenticate-user";
import {
  userRoles,
  userSignUpPath,
} from "../../utils/constants";
import {
  handleOpenPopover,
  handleShowPopoverMessage,
  handleShowCloseOptions,
} from "../../redux/slices/exception-popover-slice";
import { RoleContext } from "../role-provider";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import MenuIcon from "../../public/icons/menu-icon";
import PopoverComponent from "../../commonComponents/popover-component";
import CommonModal from "../../commonComponents/common-modal";
import Button from "../../commonComponents/button";
import { getUserRoleFromToken } from "../../utils/auth";
import AssignSalesDirectorModal from "./assign-sales-director-modal";

// Interface for sales team member row data
export interface SalesTeamRow {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  mobile?: string;
  profileImageUrl?: string;
  associatedUserIds?: string[];
  [key: string]: any;
}

/**
 * SalesTeamActionCell - Action menu for each sales team member row
 * Shows "Onboard" and "Assign Sales Director" (for Sales Representatives only)
 * Follows same pattern as NurseActionsCell
 */
const SalesTeamActionCell: React.FC<{ row: SalesTeamRow }> = ({ row }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const authenticateUser = useAuthenticateUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAssignDirector, setShowAssignDirector] = useState(false);

  /**
   * handleOnboard - Sends registration/onboarding email to the sales team member
   * Uses same authenticateUser service as PCG onboarding
   */
  const handleOnboard = () => {
    // Validate email exists before attempting onboard
    if (!row?.email) {
      dispatch(handleOpenPopover());
      dispatch(
        handleShowPopoverMessage(
          "Onboarding unsuccessful. Email address is required.",
        ),
      );
      dispatch(handleShowCloseOptions());
      setShowConfirm(false);
      return;
    }

    // Send signup/onboard email using authenticate user service
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
          dispatch(handleShowPopoverMessage("Onboarding email sent successfully."));
          setShowConfirm(false);
        },
        onError: (error: any) => {
          const apiError = error?.response?.data?.error;
          const errorMessage =
            !Array.isArray(apiError) && apiError ? apiError : "Onboarding failed";
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage(errorMessage));
          dispatch(handleShowCloseOptions());
          setShowConfirm(false);
        },
      },
    );
  };

  // Only show actions if user has edit access
  if (!hasAccess(role as Role, "HCM_SALES_TEAM", "EDIT")) {
    return null;
  }

  return (
    <div>
      {/* Popover menu with Onboard and Assign Sales Director options */}
      <PopoverComponent
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        body={
          <div className="w-[180px]">
            {/* Onboard action - available for all sales team members */}
            <div
              className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                setShowConfirm(true);
              }}
            >
              Onboard
            </div>

            {/* Assign Sales Reps - only shown for Sales Directors */}
            {row?.role === userRoles.SALES_DIRECTOR && (
              <div
                className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setShowAssignDirector(true);
                }}
              >
                Assign Sales Reps
              </div>
            )}
          </div>
        }
      >
        <MenuIcon />
      </PopoverComponent>

      {/* Assign Sales Reps modal - uses the common AssignUsersModal */}
      {showAssignDirector && (
        <AssignSalesDirectorModal
          isOpen={showAssignDirector}
          setIsOpen={setShowAssignDirector}
          salesRep={row || {}}
        />
      )}

      {/* Confirmation modal before onboarding */}
      <CommonModal
        title="Onboard Sales Team Member"
        modalOpen={showConfirm}
        setModalOpen={setShowConfirm}
        crossCTA
      >
        <div className="font-poppins px-[20px]">
          <div className="mb-4">
            <div className="font-poppins text-sm text-gray-700 mb-4">
              Are you sure you want to onboard this sales team member?
              <hr />
              <div>
                <strong>Note:</strong> An email will be sent to the sales team
                member for onboarding.
              </div>
            </div>
          </div>
          <div className="flex gap-4 justify-end">
            <Button
              name="Cancel"
              classname="!bg-gray-200 !text-black"
              buttonClick={() => setShowConfirm(false)}
            />
            <Button name="Confirm" buttonClick={handleOnboard} />
          </div>
        </div>
      </CommonModal>
    </div>
  );
};

export default SalesTeamActionCell;
