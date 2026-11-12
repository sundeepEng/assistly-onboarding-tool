import React, { useState } from "react";
import CommonModal from "../commonComponents/common-modal";
import Button from "../commonComponents/button";
import { TailSpin } from "react-loader-spinner";
import { useDispatch } from "react-redux";
import { handleOpenPopover, handleShowPopoverMessage } from "../redux/slices/exception-popover-slice";
import { ProtectedComponent } from "./protectedComponent";
import { getUserRoleFromToken } from "../utils/auth";
import { Role } from "../utils/roles";

function Footer() {
  const [openModal, setOpenModal] = useState(false);
  const [isLoading,setIsLoading] = useState(false)
  const [message,setMessage] = useState("")
  const dispatch = useDispatch();
  const handleConfirm=()=>{
    setIsLoading(true)
    setOpenModal(false)
     setIsLoading(false)
     dispatch(handleOpenPopover())
     dispatch(handleShowPopoverMessage("Unsubscribed"))
  }
  const role=getUserRoleFromToken()
  return (
    <footer className="w-full bg-primary/15 px-[50px]">
      <div className=" max-w-screen-xl mx-auto flex flex-row md:flex-row items-center justify-between gap-4 text-[11px] text-black font-poppins">
        <p className="flex text-center md:text-left w-full">
          © {new Date().getFullYear()} Copyright - All Rights Reserved
        </p>
         <div className="flex gap-4 w-full text-right justify-end">
          <ProtectedComponent role={role as Role} feature={"UNSUBSCRIBE"} access={"EDIT"} >
          <div className="flex gap-4">
          <p
            className="text-center md:text-right underline cursor-pointer"
            onClick={() => {setOpenModal(true),setMessage("SMS")}}
          >
            unsubscribe SMS
          </p>
          <p
            className="text-center md:text-right underline cursor-pointer"
            onClick={() => {setOpenModal(true),setMessage("Email")}}
          >
            unsubscribe Email
          </p>
          </div>
          </ProtectedComponent>
        </div>
        <CommonModal
          title=""
          modalOpen={openModal}
          setModalOpen={setOpenModal}
          width="500px"
          crossCTA={true}
        >
          <div className="font-poppins min-w-[450px] px-[20px]">
          <div className="mb-4">
           <div className="text-sm text-gray-700 mb-4"> Are you sure you want to unsubscribe from {message} ?</div>
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
                buttonClick={()=>setOpenModal(false)}
              />
            </div>
          )}
        </div>
        </CommonModal>
      </div>
    </footer>
  );
}

export default Footer;
