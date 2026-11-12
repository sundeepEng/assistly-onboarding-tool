import { useRouter } from "next/router";
import React from "react";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import Avatar from "../../commonComponents/avatar";

// Interface for the sales team cell props
interface SalesTeamCellProps {
  name: string;
  data?: {
    userId: string;
    role: string;
    profileImageUrl?: string;
  };
}

/**
 * SalesTeamCell - Displays name + avatar in the table row
 * Clicking on the name navigates to the sales member detail page
 * Follows same pattern as PCGCell / LeadCell
 */
const SalesTeamCell: React.FC<SalesTeamCellProps> = ({ name, data }) => {
  const router = useRouter();
  const dispatch = useDispatch();

  // Navigate to sales member detail page
  const navigateToSalesMember = () => {
    if (data?.userId) {
      // router.push(`/hcm/sales-team/${data.userId}`);
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Sales member data not found"));
    }
  };

  return (
    <div className="flex items-center gap-3 pl-[20px] font-jakarta">
      <Avatar src={data?.profileImageUrl} name={name} size={40} />
      <div
        className="flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap"
        onClick={navigateToSalesMember}
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

export default SalesTeamCell;
