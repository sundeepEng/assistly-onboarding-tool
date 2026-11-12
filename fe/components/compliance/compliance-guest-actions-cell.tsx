'use client'
import React, { useState } from "react";
import MenuIcon from "../../public/icons/menu-icon";
import PopoverComponent from "../../commonComponents/popover-component";
import CommonModal from "../../commonComponents/common-modal";
import { TailSpin } from "react-loader-spinner";
import Button from "../../commonComponents/button";
import { useDispatch } from "react-redux";
import { handleOpenPopover, handleShowCloseOptions, handleShowPopoverMessage } from "../../redux/slices/exception-popover-slice";
import useAuthenticateUser from "../../services/authenticate-user";
import { UserPath, userSignUpPath } from "../../utils/constants";
import useDelete from "../../services/delete";

const ComplianceGuestActionsCell = ({row}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<"registerGuest"|"deleteComplianceGuest" | null>(null);
  const dispatch = useDispatch();
  const { mutate: deleteUserMutate } = useDelete();
  const authenticateUser = useAuthenticateUser();
  const handleRegisterGuest = () => {
      if (!row?.email) {
        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            "Registration unsuccessful. Email address is required."
          )
        );
        dispatch(handleShowCloseOptions());
        // closeMenu();
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
            dispatch(handleShowPopoverMessage("Mail Sent!"));
            // closeMenu();
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage(
                `${
                  error?.response?.data?.error?.name === "UsernameExistsException"
                    ? "Compliance Guest registered!"
                    : `${error?.response?.data?.message}`
                }`
              )
            );
            dispatch(handleShowCloseOptions());
            // closeMenu();
          },
        }
      );
       setShowConfirm(false);
    };
  const handleConfirm = async () => {
        if (actionType === "registerGuest") {
          handleRegisterGuest();
        } else if(actionType==="deleteComplianceGuest"){
           const path = UserPath;
               const ComplianceGuestId = row?.userId;
               deleteUserMutate({ id: ComplianceGuestId, path },{onSuccess:()=>{
                 dispatch(handleOpenPopover())
                 dispatch(handleShowPopoverMessage("Compliance Guest deleted successfully!"))
               },onError:(error:any)=>{
                     dispatch(handleOpenPopover());
                     dispatch(handleShowCloseOptions());
                     dispatch(
                       handleShowPopoverMessage(
                         !Array?.isArray(error?.response?.data?.error)
                           ? error?.response?.data?.error
                           : "Failed to delete compliance guest."
                       )
                     );
                   },});
               setShowConfirm(false) 
        }
      };
  return (
    <div>
      <>
        <PopoverComponent
          isOpen={isMenuOpen}
          setIsOpen={setIsMenuOpen}
          body={
            <div className="w-[140px]">
              {/* {canEdit && ( */}
              <div>
                <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("registerGuest");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Onboard
                </div>
                 <div
                  className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                  onClick={() => {
                    setActionType("deleteComplianceGuest");
                    setIsMenuOpen(false);
                    setShowConfirm(true);
                  }}
                >
                  Delete
                </div>
              </div>
              {/* )} */}
            </div>
          }
        >
          <MenuIcon />
        </PopoverComponent>

        <CommonModal
           title={
          actionType === "registerGuest"
            ? "Onboard Compliance Guest"
            : actionType === "deleteComplianceGuest"
            ? "Delete Compliance Guest"
            : ""
        }
          modalOpen={showConfirm}
          setModalOpen={setShowConfirm}
          crossCTA
        >
          <div className="font-poppins px-[20px]">
            <div className="mb-4">
              {actionType === "registerGuest" ? (
              <div className="font-poppins text-sm text-gray-700 mb-4">
                Are you sure you want to onboard this Compliance Guest?
                <hr />
                <div>
                  <strong>Note:</strong> An email will be sent to the Compliance Guest for
                  onboarding.
                </div>
              </div>
            ):actionType === "deleteComplianceGuest" ? (
              <div className="text-sm text-gray-700 mb-4">
                Are you sure you want to permanently delete this Compliance Guest?
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
      </>
    </div>
  );
};

export default ComplianceGuestActionsCell;
