import { useRouter } from "next/router";
import React, { useContext, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import BaseTable from "../commonComponents/base-table";
import LeadCell from "../commonComponents/leads-table/lead-cell";
import Stage from "../commonComponents/stage";
import Button from "../commonComponents/button";
import CommonModal from "../commonComponents/common-modal";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import useGetAll from "../services/getAll";
import { ApiError } from "../types/error-type";
import { AUDIENCE_LABELS, GetUsersPath, UserPath, userRoles, milestones } from "../utils/constants";
import { formatDate, getDaysAgo } from "../utils/dateUtils";
import { hasAccess } from "../utils/roleAccess";
import { Role } from "../utils/roles";
import { RoleContext } from "./role-provider";
import LeadActionsCell from "./lead-action-cell";
import Loader from "../commonComponents/loader";
import { getHomeIdFromToken, getUserIdFromToken, getUserRoleFromToken, getIsSalesRequiredFromCookie } from "../utils/auth";
import RestrictedPage from "../commonComponents/restricted";
import CampaignModal from "./referral/campaign-modal";
import useGetById from "../services/getById";

export interface Lead {
  docusignEnvelopeStatus: string;
  email: string;
  role: string;

  userId: string;
  name: string;
  added: string;
  milestone: string[];
  contacted: string;
  actions: string;
  createdAt: string;
  updatedAt: string;
  tour_completed: string;
  tourNotes: string;
  modifiedAt?: string;
  profileImageUrl?: string;
  clinical?: any;
  onboardingESignEnvelopeStatus?: string;
  isReferredByUserName?: string;
}

const LeadsTable: React.FC<{ milestoneFilter?: string }> = ({ milestoneFilter = "" }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const [activeBulkCampaign, setActiveBulkCampaign] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [resetSelectionKey, setResetSelectionKey] = useState(0);

  if (!role) return null;

  if (!hasAccess(role as Role, "CRM_DASHBOARD", "EDIT")) {
    if (hasAccess(role as Role, "CRM_BIOGRAPHY", "EDIT")) {
      router.push(`/crm/${getUserIdFromToken()}`);
      return null;
    } else {
      return <div><RestrictedPage /></div>;
    }
  }

  const user = getUserIdFromToken();
  const homeId = getHomeIdFromToken();

  const isSalesRep = role === userRoles.SALES_REPRESENTATIVE;
  const isSalesDirector = role === userRoles.SALES_DIRECTOR;
  const isSalesRequired = getIsSalesRequiredFromCookie() ?? false;

  const { data: currentUserData } = useGetById({
    key: "currentUser",
    payload: {
      id: user || "",
      path: UserPath,
      enabled: isSalesDirector && !!user,
    },
  });

  const getIsReferredByUserId = (): string | string[] | undefined => {
    if (isSalesRep && user) return user;
    if (isSalesDirector && user) {
      const associatedIds = (currentUserData as any)?.associatedUserIds || [];
      return [user, ...associatedIds];
    }
    return undefined;
  };

  const { data, isLoading, error } = useGetAll({
    key: userRoles.LEAD,
    params: {
      userType: userRoles.LEAD,
      homeId: homeId,
      ...(getIsReferredByUserId() ? { isReferredByUserId: getIsReferredByUserId() } : {}),
    },
    path: GetUsersPath,
  });

  if (error) {
    const apiError = error as ApiError;
    dispatch(handleOpenPopover());
    dispatch(handleShowPopoverMessage(apiError?.response?.data?.message));
    dispatch(handleShowCloseOptions());
  }

  const sortedLeads = useMemo(() => {
    const users = data?.users || [];
    const nonLost = users.filter((u: Lead) => !u.milestone?.includes(milestones.LOST));
    const lost = users.filter((u: Lead) => u.milestone?.includes(milestones.LOST));
    if (milestoneFilter) {
      const withMilestone = nonLost.filter((u: Lead) => u.milestone?.includes(milestoneFilter));
      const withoutMilestone = nonLost.filter((u: Lead) => !u.milestone?.includes(milestoneFilter));
      return [...withMilestone, ...withoutMilestone, ...lost];
    }
    return [...nonLost, ...lost];
  }, [data?.users, milestoneFilter]);

  const columns = [
    {
      header: "Name",
      field: "name" as keyof Lead,
      render: (_value: string, row: Lead) => (
        <LeadCell lead={row.name} data={row} />
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
      minWidth: "250px",
    },
    {
      header: "Added",
      field: "createdAt" as keyof Lead,
      render: (_value: string) => <p>{formatDate(_value)}</p>,
      headerClassName: "pl-[5px] text-xs font-medium",
    },
    {
      header: "Milestones",
      field: "milestone" as keyof Lead,
      render: (_value: string[], row: Lead) => (
        <div className="select-none ">
          <Stage data={row} />
        </div>
      ),
      headerClassName: "pl-[10px] text-xs font-medium",
      minWidth: "350px",
    },
    {
      header: "Contacted",
      field: "contacted" as keyof Lead,
      render: (_value: string, row: Lead) => (
        <div className="select-none">
          {getDaysAgo(row.modifiedAt, row.createdAt)}
        </div>
      ),
      minWidth: "150px",
      headerClassName: " text-xs font-medium"
    },
    ...(isSalesRequired
      ? [
        {
          header: "Lead Owner",
          field: "isReferredByUserName" as keyof Lead,
          render: (_value: string) => <p>{_value || "-"}</p>,
          minWidth: "150px",
          headerClassName: "pl-[5px] text-xs font-medium",
        },
      ]
      : []),
    {
      header: "",

      field: "actions" as keyof Lead,
      render: (_value: string, row: Lead) => <LeadActionsCell row={row} />,
      minWidth: "150px",
      headerClassName: "flex justify-end"
    },
    // Temperarily actions is removed, change according to requirements in feature
    // {
    //     header: "Actions",
    //     field: "actions" as keyof Lead,
    //     render: (_value: string, row: Lead) => <ActionCell />,
    //     minWidth: "120px",
    // },
  ];

  const handleSetCampaignModal = (open: boolean) => {
    setCampaignModal(open);

    if (!open) {
      setSelectedLeads([]);
      setActiveBulkCampaign(false);
      setResetSelectionKey(prev => prev + 1);
    }
  };

  const handleSendBulkEmailButtonClick = () => {
    setCampaignModal(true);
  };

  if (isLoading) {
    return (
      <div className="font-poppins">
        <Loader />
      </div>
    );
  }
  return (
    <div className="">
      <CommonModal
        modalOpen={campaignModal}
        setModalOpen={handleSetCampaignModal}
        crossCTA={true}
      >
        <div className="w-[600px]">
          <CampaignModal
            selectedReferrals={selectedLeads}
            setCampaignModal={handleSetCampaignModal}
            campaignAudience={AUDIENCE_LABELS.senior}
          />
        </div>
      </CommonModal>

      <div className={`flex justify-end pb-[20px] `}>
        <Button
          name={"Send Bulk Campaign"}
          buttonClick={() => {
            handleSendBulkEmailButtonClick();
          }}
          disabled={!activeBulkCampaign}
        />
      </div>

      <BaseTable
        columns={columns}
        data={sortedLeads}
        headerStyles="pt-[5px]"
        rowStyles={(row: Lead) =>
          row.milestone?.includes(milestones.LOST)
            ? "bg-[#bcb9b9] opacity-50"
            : milestoneFilter && row.milestone?.includes(milestoneFilter)
              ? "bg-primary/10"
              : ""
        }
        cellStyles={(field, value, row) =>
          field === "actions" ? "justify-end h-full pr-[10px]" : "flex h-full"
        }
        tableContainerClass={" bg-white"}
        checkbox={true}
        setActiveBulkCampaign={setActiveBulkCampaign}
        onRowSelectionChange={setSelectedLeads}
        resetSelectionKey={resetSelectionKey}
        isRowDisabled={(row: Lead) => row.milestone?.includes(milestones.LOST)}
      />
    </div>
  );
};

export default LeadsTable;
