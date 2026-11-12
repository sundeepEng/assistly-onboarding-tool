import { useRouter } from "next/router";
import React, { useContext, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import HoverNotesComponent from "../../commonComponents/hover-notes";
import Avatar from "../../commonComponents/avatar";
import { CLINICAL, CRM, userRoles } from "../../utils/constants";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { getUserRoleFromToken } from "../../utils/auth";

interface PCGCellProps {
  name: string;
  data?: {
    userId: string;
    role: string;
    profileImageUrl?: string;
  };
}

const PCGCell: React.FC<PCGCellProps> = ({ name, data }) => {
  const router = useRouter();
  const dispatch = useDispatch();

  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const isCRM = router.pathname.startsWith("/crm");
  const canNavigateInCRM = useMemo(() => {
    if (!isCRM) return true;
    return hasAccess(role as Role, "CARE_LEAD_NAME", "EDIT");
  }, [isCRM, role]);

  const navigateToPCG = () => {
    if (!canNavigateInCRM) return;
    if (data?.userId) {
      router.push(
        `/${data?.role === userRoles?.PCGLEAD ? CRM : CLINICAL}/pcg/${
          data.userId
        }`,
      );
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("PCG data not found"));
    }
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 pl-[20px] font-jakarta">
      <HoverNotesComponent data={data}>
        <Avatar src={data?.profileImageUrl} name={name} size={40} />
      </HoverNotesComponent>
      <div
        className={`flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap ${
          canNavigateInCRM ? "cursor-pointer" : "cursor-default"
        }`}
        onClick={canNavigateInCRM ? navigateToPCG : undefined}
      >
        <p
          className={`m-0 truncate max-w-[250px] overflow-hidden whitespace-nowrap text-ellipsis text-s ${
            canNavigateInCRM ? "cursor-pointer" : "cursor-default"
          }`}
          title={name}
        >
          {name?.length > 15 ? `${name.substring(0, 15)}...` : name}
        </p>
      </div>
    </div>
  );
};

export default PCGCell;
