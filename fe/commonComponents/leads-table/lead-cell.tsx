import { useRouter } from "next/router";
import React, { useContext, useMemo } from "react";
import { useDispatch } from "react-redux";
import { Lead } from "../../components/leads-table";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import HoverNotesComponent from "../hover-notes";
import Avatar from "../avatar";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../../components/role-provider";
import { getUserRoleFromToken } from "../../utils/auth";

interface LeadCellProps {
  lead: string;
  initial?: string;
  data?: Lead;
}

const LeadCell: React.FC<LeadCellProps> = ({ lead, initial, data }) => {
    const router = useRouter();
  const dispatch = useDispatch();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const canNavigate = useMemo(() => {
    return hasAccess(role as Role, "CARE_LEAD_NAME", "EDIT");
  }, [role]);
  const canViewBiography = hasAccess(role as Role, "CRM_BIOGRAPHY", ["EDIT", "VIEW"]);


  const navigateLead = () => {
    if (!canNavigate) return;
    if (!canViewBiography) return;
        if (data) {
            router.push(`/crm/${data?.userId}`);
        } else {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Lead data not found"));
        }
    };
    return (
        <div className="flex items-center gap-3 pl-[20px] font-jakarta">
            <HoverNotesComponent data={data}>
                <Avatar src={data?.profileImageUrl} name={lead} size={40} />
            </HoverNotesComponent>
            <div
                className={`flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap ${canViewBiography ? "" : "pointer-events-none"} ${canNavigate ? "cursor-pointer" : "cursor-default"}`}
                onClick={navigateLead}
            >
                <p
                    className={`m-0 truncate max-w-[150px] overflow-hidden whitespace-nowrap text-ellipsis text-s ${canViewBiography ? "cursor-pointer" : "cursor-default"} ${ canNavigate ? "cursor-pointer" : "cursor-default"
          }`}
                    title={lead} // Shows full name on hover
                >
                    {lead?.length > 15 ? `${lead.substring(0, 15)}...` : lead}
                </p>
            </div>
        </div>
    );
};

export default LeadCell;
