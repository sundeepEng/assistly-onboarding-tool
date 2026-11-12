'use client'
import React, { useState } from "react";
import MenuIcon from "../../public/icons/menu-icon";
import PopoverComponent from "../../commonComponents/popover-component";
import { UserPath } from "../../utils/constants";
import useDelete from "../../services/delete";
import { useDispatch } from "react-redux";
import { handleOpenPopover, handleShowCloseOptions, handleShowPopoverMessage } from "../../redux/slices/exception-popover-slice";
import { handleOpenEditReferralModal } from "../../redux/slices/modal-slice";
import CommonModal from "../../commonComponents/common-modal";
import { TailSpin } from "react-loader-spinner";
import Button from "../../commonComponents/button";

const ReferralActionCell = ({ row }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<
    "deleteReferral" | "editReferral" | null
  >(null);
  const { mutate: deleteUserMutate } = useDelete();
  const dispatch = useDispatch();
  const handleConfirm = async () => {
    if (actionType === "deleteReferral") {
      const path = UserPath;
      const PCGLeadId = row?.userId;
      deleteUserMutate(
        { id: PCGLeadId, path },
        {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Referral deleted successfully!"));
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Failed to delete referral."
              )
            );
          },
        }
      );
      setShowConfirm(false);
    }
  };

  // Handle opening edit modal - dispatch action to open modal with referral data
  const handleEditClick = () => {
    setIsMenuOpen(false);
    // Dispatch action to open edit modal with referral data for pre-filling the form
    dispatch(handleOpenEditReferralModal(row));
  };
  return (
    <div>
      <PopoverComponent
        body={
          <div>
            {/* Edit option - opens modal with referral data for editing */}
            <div
              className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md w-[140px]"
              onClick={handleEditClick}
            >
              Edit
            </div>
            {/* Delete option - shows confirmation modal */}
            <div
              className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md w-[140px]"
              onClick={() => {
                setActionType("deleteReferral");
                setIsMenuOpen(false);
                setShowConfirm(true);
              }}
            >
              Delete
            </div>
          </div>
        }
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
      >
        <MenuIcon />
      </PopoverComponent>
      <CommonModal
        title={
          actionType === "deleteReferral"
            ? "Delete Referral"
            : ""
        }
        modalOpen={showConfirm}
        setModalOpen={setShowConfirm}
        crossCTA
      >
        <div className="font-poppins px-[20px]">
          <div className="mb-4">
            {actionType === "deleteReferral" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to permanently delete this Referral?
              </div>) : null}
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

export default ReferralActionCell;
