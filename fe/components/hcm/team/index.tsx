import { useDispatch } from "react-redux";
import { useContext, useEffect, useState } from "react";
import { useAppSelector } from "../../../redux/hooks";
import { handleSetTeamMemberActiveTab } from "../../../redux/slices/team-tab-slices";
import Documents from "./documents";
import JobDetails from "./job-details";
import PersonalInformation from "./personal-information";
import Tabs from "../../../commonComponents/tabs";
import { RoleContext } from "../../role-provider";
import { getUserRoleFromToken } from "../../../utils/auth";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { userRoles } from "../../../utils/constants";

const TeamDetailView = () => {
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  const canViewJobDetails = hasAccess(role as Role, "HCM_TEAM_JOB_DETAILS", [
    "VIEW",
    "EDIT",
  ]);
  const canViewDocuments = hasAccess(
    role as Role,
    "CARE_TEAM_DOCUMENTS",
    "EDIT",
  );

  const tabs = [
    canViewJobDetails
      ? {
          label: "Job Details",
          content: <JobDetails />,
        }
      : null,
    {
      label: "Personal Information",
      content: <PersonalInformation />,
    },
    canViewDocuments
      ? {
          label: "Documents",
          content: <Documents />,
        }
      : null,
  ].filter(Boolean);
  const activeTab = useAppSelector(
    (state: { teamMemberTab: { activeTab: string } }) =>
      state.teamMemberTab.activeTab,
  );
  const dispatch = useDispatch();

  useEffect(() => {
    const labels = (tabs as any[])?.map((t) => t?.label).filter(Boolean);
    const firstTab = labels?.[0];

    if (firstTab && !labels.includes(activeTab)) {
      dispatch(handleSetTeamMemberActiveTab(firstTab));
    }
  }, [activeTab, dispatch, tabs]);

  const handleTabChange = (label: string) => {
    dispatch(handleSetTeamMemberActiveTab(label));
  };
  return (
    <div>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        containerClassName="!bg-[#f4f4f4] border-b border-solid border-[#C8C8CC] rounded mb-6"
        contentClassName="px-4 pb-4"
      />
    </div>
  );
};

export default TeamDetailView;
