import React, { useContext, useEffect } from "react";
import PCGActions from "./pcg-actions";
import CareTeamFaceSheet from "../face-sheet/care-team-face-sheet";
import Tabs from "../../commonComponents/tabs";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { handleSetCareTeamActiveTab } from "../../redux/slices/tab-slice";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { getUserRoleFromToken } from "../../utils/auth";
import { TabData } from "../clinical/clinicalTabs/clinical-tabs";

const PcgTabs = ({ pcgID }: { pcgID: string }) => {
  const tokenRole = getUserRoleFromToken();
  const providerRole = useContext(RoleContext)?.role;
  const contextRole = tokenRole ?? providerRole;

  const tabData: TabData[] = [
    {
      label: "Documents",
      content: <PCGActions pcgID={pcgID} />,
      access: [{ feature: "CARE_TEAM_DOCUMENTS", type: ["EDIT"] }],
    },
    {
      label: "FaceSheet",
      content: <CareTeamFaceSheet pcgID={pcgID} />,
      access: [{ feature: "CARE_TEAM_FACE_SHEET", type: ["VIEW", "EDIT"] }],
    },
  ];
  const filteredTabData = tabData?.filter((tab) =>
    tab?.access?.some(({ feature, type }) =>
      hasAccess(contextRole as Role, feature, type),
    ),
  );
  const leadDataActiveTab = useAppSelector(
    (state: { tab: { careTeamActiveTab: string } }) =>
      state.tab.careTeamActiveTab,
  );
  const dispatch = useAppDispatch();

  useEffect(() => {
    const labels = (filteredTabData as any[])
      ?.map((t) => t?.label)
      .filter(Boolean);
    const firstTab = labels?.[0];

    if (firstTab && !labels.includes(leadDataActiveTab)) {
      dispatch(handleSetCareTeamActiveTab(firstTab));
    }
  }, [dispatch, filteredTabData, leadDataActiveTab]);

  const handleTabChange = (label: string) => {
    dispatch(handleSetCareTeamActiveTab(label));
  };
  return (
    <div>
      <Tabs
        tabs={filteredTabData}
        containerClassName="rounded-t-[10px] pt-[5px]"
        activeTabClassName="text-[black] text-2xl"
        activeTab={leadDataActiveTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
};

export default PcgTabs;
