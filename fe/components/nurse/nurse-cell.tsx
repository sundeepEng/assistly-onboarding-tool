'use client'
import { useRouter } from "next/router";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import HoverNotesComponent from "../../commonComponents/hover-notes";
import Avatar from "../../commonComponents/avatar";
import { CLINICAL, CRM, userRoles } from "../../utils/constants";

interface NurseCellProps {
  name: string;
  data?: {
    userId: string;
    role: string;
    profileImageUrl?: string;
  };
}

// Renders the Nurse/Nurse Lead avatar + name cell and handles navigation to the nurse details page.
const NurseCell: React.FC<NurseCellProps> = ({ name, data }) => {
  const router = useRouter();
  const dispatch = useDispatch();

  // Navigates to CRM details for NurseLead, otherwise navigates to Clinical details.
  const navigateToNurse = () => {
    if (data?.userId) {
      router.push(
        `/${data?.role === userRoles?.NURSELEAD ? CRM : CLINICAL}/nurse/${
          data.userId
        }`
      );
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Nurse data not found"));
    }
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 pl-[20px] font-jakarta">
      <HoverNotesComponent data={data}>
        <Avatar src={data?.profileImageUrl} name={name} size={40} />
      </HoverNotesComponent>
      <div
        className="flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap"
        // onClick={navigateToNurse}
      >
        <p
          className="m-0 truncate max-w-[250px] overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer text-s"
          title={name}
        >
          {name?.length > 15 ? `${name.substring(0, 15)}...` : name}
        </p>
      </div>
    </div>
  );
};

export default NurseCell;
