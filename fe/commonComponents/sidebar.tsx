import { useRouter } from "next/router";
import { useContext, useEffect, useMemo, useState } from "react";
import SidebarCell from "./sidebar-cell";
import {
  CRM,
  leadActiveTabConstants,
  leadCarePlanTabConstants,
  getSidebarCellData,
  userRoles,
  UserPath,
  routeItems,
  InHomeCare,
  homePath,
  salesDashboardPath,
} from "../utils/constants";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import {
  handleSetCarePlanLeadActiveTab,
  handleSetLeadActiveTab,
} from "../redux/slices/tab-slice";
import _ from "lodash";
import { RoleContext } from "../components/role-provider";
import {
  getUserRoleFromToken,
  getHomeIdFromToken,
  getUserIdFromToken,
  getIsSalesRequiredFromCookie,
} from "../utils/auth";
import { Role, roleNavAllow } from "../utils/roles";
import crmDashboardIcon from "../public/icons/crm-dashboard-icon";
import ClinicalDashboardIcon from "../public/icons/clinical-dashboard-icon";
import StaffManagmentDashboardIcon from "../public/icons/staff-management-dashboard-icon";
import ComplianceDashboardIcon from "../public/icons/compliance-dashboard-icon";
import { setScheduleDate } from "../redux/slices/schedule-date-slice";
import { ArrowBigLeft, ArrowBigRight } from "lucide-react";
import { handleSetSidebarCollapse } from "../redux/slices/sidebar-slice";
import { ProtectedComponent } from "../components/protectedComponent";
import useGetById from "../services/getById";
import UpgradeModal from "./upgrade-modal";
import { useAuthorizedModules } from "../utils/useAuthorizedModules";
import RevopsIcon from "../public/icons/revops-icon";
type Section = "crm" | "clinical" | "hcm" | "compliance" | "revops";

type SidebarItem = {
  name: string;
  icon?: React.ComponentType<any>;
  path: string;
  key: string;
  section: Section;
  feature: string;
};

const SECTIONS: {
  id: Section;
  title: string;
  path: string;
  icon: any;
  feature: string;
}[] = [
    {
      id: "crm",
      title: "CRM",
      path: "/crm",
      icon: crmDashboardIcon,
      feature: "CRM_NAV",
    },
    {
      id: "clinical",
      title: "Clinical",
      path: "/clinical",
      icon: ClinicalDashboardIcon,
      feature: "CLINICAL_NAV",
    },
    {
      id: "hcm",
      title: "Staff Management",
      path: "/hcm",
      icon: StaffManagmentDashboardIcon,
      feature: "STAFF_MANAGEMENT_NAV",
    },
    {
      id: "compliance",
      title: "Compliance",
      path: "/compliance",
      icon: ComplianceDashboardIcon,
      feature: "COMPLIANCE_NAV",
    },
    {
      id: "revops",
      title: "RevOps",
      path: "/revops",
      icon: RevopsIcon,
      feature: "REVOPS_NAV",
    },
  ];

function itemsForSection(
  section: Section,
  role: Role,
  all: SidebarItem[],
  isCompliancePartner?: boolean,
  isSalesRequired?: boolean,
): SidebarItem[] {
  const sectionItems = all.filter((i) => i.section === section);

  // If roleNavAllow lists features per section, use feature to filter.
  const allowedFeatures: string[] =
    (roleNavAllow as any)?.[role]?.[section] ??
    sectionItems.map((i) => i.feature);

  let filteredItems = sectionItems.filter((i) =>
    allowedFeatures.includes(i.feature),
  );

  // Additional filter: Remove compliance guest from CRM if PCHO is not a compliance partner
  if (
    section === routeItems.CRM &&
    (role === userRoles.PCHO || role === userRoles.HOME_ADMIN) &&
    !isCompliancePartner
  ) {
    filteredItems = filteredItems.filter(
      (i) => i.key !== routeItems.COMPLIANCE_GUEST,
    );
  }

  // Hide sales-related items (CRM Sales Dashboard, HCM Sales Team) when sales is not required for the home
  if (!isSalesRequired) {
    filteredItems = filteredItems.filter(
      (i) =>
        i.feature !== "CRM_SALES_DASHBOARD" && i.feature !== "HCM_SALES_TEAM",
    );
  } else if (section === routeItems.CRM) {
    // When sales is required, surface the Sales Dashboard at the top of the CRM section
    const salesIdx = filteredItems.findIndex(
      (i) => i.feature === "CRM_SALES_DASHBOARD",
    );
    if (salesIdx > 0) {
      const [salesItem] = filteredItems.splice(salesIdx, 1);
      filteredItems.unshift(salesItem);
    }
  }

  return filteredItems;
}

type BuildSidebarArgs = {
  role: Role;
  activeTab: Section;
};

// function buildSidebar({ role, activeTab }: BuildSidebarArgs) {
//   const sectionItems = sidebarCellData.filter((i) => i.section === activeTab);
//   const allowListForRole =
//     roleNavAllow[role]?.[activeTab] ?? sectionItems.map((i) => i.key);
//   const final = sectionItems.filter((i) =>
//     allowListForRole.includes(i.feature)
//   );
//   return final;
// }

export default function Sidebar() {
  const router = useRouter();
  const [activeCell, setActiveCell] = useState("");
  const [activeGroup, setActiveGroup] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [unauthorizedModule, setUnauthorizedModule] = useState("");
  const dispatch = useAppDispatch();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const homeId = getHomeIdFromToken();
  const today = new Date();

  const userId = getUserIdFromToken();

  // Fetch PCHO data to check isCompliancePartner
  const { data: pchoData } = useGetById({
    key: "pcho-data",
    payload: {
      id: userId,
      path: UserPath,
      enabled: !!userId,
    },
  });

  // Get isSalesRequired from cookie
  const isSalesRequired = getIsSalesRequiredFromCookie() ?? false;

  // Check if PCHO has compliance partner access
  // Default to false (hide compliance guest) until data is loaded
  const isCompliancePartner =
    role === userRoles.PCHO ? (pchoData?.isCompliancePartner ?? false) : false;
  const authorizedModules = useAuthorizedModules();
  const isSenior = role === userRoles.SENIOR;
  const isPcho = role === userRoles.PCHO;

  useEffect(() => {
    const handleChange = (e: MediaQueryListEvent) => {
      if (mediaQuery.matches) dispatch(handleSetSidebarCollapse(true));
      if (mediaQuery2.matches) dispatch(handleSetSidebarCollapse(false));
    };
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const mediaQuery2 = window.matchMedia("(min-width: 900px)");
    mediaQuery.addEventListener("change", handleChange);
    mediaQuery2.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const activeTab = useAppSelector(
    (state: { dashboardTab: { activeTab: string } }) =>
      state.dashboardTab.activeTab,
  );
  const collapse = useAppSelector(
    (state: { sidebarCollapse: { collapse: boolean } }) =>
      state.sidebarCollapse.collapse,
  );

  // Build grouped data once per role/permissions
  const grouped = useMemo(() => {
    return SECTIONS.map((s) => ({
      ...s,
      isAuthorized: authorizedModules.includes(s.title.toUpperCase()),
      items: itemsForSection(
        s.id,
        role as Role,
        getSidebarCellData(role) as SidebarItem[],
        isCompliancePartner,
        isSalesRequired,
      ),
    }));
  }, [role, isCompliancePartner, pchoData, authorizedModules, isSalesRequired]);

  // Only expanded section's items are rendered; others show just the header.
  const expanded = useMemo(
    () => grouped.find((g) => g.id === activeTab),
    [grouped, activeTab],
  );
  // Prefetch only expanded items
  useEffect(() => {
    if (!expanded?.items?.length) return;
    expanded.items.forEach((item) => router.prefetch(item.path));
  }, [expanded?.items, router]);

  const filteredTabData = getSidebarCellData(role);
  // Prefetch routes
  useEffect(() => {
    if (!filteredTabData || filteredTabData.length === 0) return;
    filteredTabData.forEach((item) => {
      router.prefetch(item.path);
    });
  }, [filteredTabData]);

  // Update active cell based on route
  useEffect(() => {
    const path = router.pathname;
    const segments = path.split("/").filter(Boolean);
    const sectionKey = segments[1] ?? segments[0];
    const matched =
      (getSidebarCellData(role) as SidebarItem[]).find(
        (item) => item.key === sectionKey,
      ) ??
      (getSidebarCellData(role) as SidebarItem[]).find((item) =>
        path.startsWith(item.path),
      );

    if (matched) {
      setActiveCell(matched.key);
    } else {
      setActiveCell("");
    }
  }, [router.pathname]);

  const handleCellClick = (name, path) => {
    setActiveCell(name);
    router.push(path);
    if (router.isReady) {
      dispatch(handleSetLeadActiveTab(leadActiveTabConstants.BIOGRAPHY_TAB));
      dispatch(
        handleSetCarePlanLeadActiveTab(leadCarePlanTabConstants.ADLS_TAB),
      );
      dispatch(setScheduleDate(today.toISOString()));
    }
  };
  const handleGroupClick = (name, path) => {
    let targetPath = path;
    if (name === routeItems.STAFF_MANAGEMENT) {
      targetPath = isSenior ? "/hcm/scheduling" : "/hcm";
    }
    if (name === routeItems.REVOPS) {
      targetPath = isPcho ? "/revops/budget" : "/revops";
    }
    if (name === routeItems.CRM && isSalesRequired) {
      targetPath = salesDashboardPath;
    }
    setActiveGroup(name);
    router.push(targetPath);
  };

  const handleUnauthorizedClick = (moduleName: string) => {
    setUnauthorizedModule(moduleName);
    setShowUpgradeModal(true);
  };
  // Render nothing if tab isn't ready
  if (!activeTab) return null;

  // Conditional rendering of sidebar content
  const shouldRenderSidebar = !(role === userRoles.PCG && activeTab === CRM);
  if (!shouldRenderSidebar) return null;
  return (
    <div className="flex">
      <nav
        className={`flex flex-col gap-2 ${collapse ? "w-[75px]" : "w-[275px]"}`}
      >
        {grouped.map((group) => (
          <ProtectedComponent
            key={group.id}
            role={role as Role}
            feature={group.feature}
            access={["EDIT", "VIEW"]}
          >
            <div>
              {/* Section header (always shown, but disabled if not authorized) */}
              <button
                key={group.id}
                onClick={() => {
                  if (group.isAuthorized) {
                    handleGroupClick(group.id, group.path);
                  } else {
                    handleUnauthorizedClick(group.title);
                  }
                }}
                className={`w-full text-left px-2 py-1 rounded-md bg-[white] ${collapse ? "w-[75px]" : "w-[275px]"
                  } ${activeTab === group.id ? "" : ""} ${!group.isAuthorized ? "opacity-50 cursor-not-allowed" : ""
                  }`}
              >
                <SidebarCell
                  name={!collapse && group.title}
                  icon={
                    group.icon ? (
                      /* @ts-ignore */ <group.icon
                        active={activeTab === group.id}
                      />
                    ) : undefined
                  }
                  active={activeTab === group.id}
                />
              </button>
              {/* <div
              className={`px-3 py-2 text-sm font-semibold uppercase tracking-wide ${
                group.id === activeTab ? "opacity-100" : "opacity-70"
              }`}
            >
              {group.title}
            </div> */}

              {/* Only show items for the active authorized section */}
              {group.id === activeTab && group.isAuthorized && !collapse && (
                <div className="flex flex-col">
                  {group.items.map((data) => (
                    <button
                      key={data.key}
                      onClick={() => handleCellClick(data.key, data.path)}
                      className={`w-full text-left px-2 py-1 rounded-r-md bg-[white]  ${activeCell === data.key
                        ? "bg-primary bg-opacity-20"
                        : ""
                        }`}
                    >
                      <SidebarCell
                        name={data.name}
                        icon={
                          data.icon ? (
                            <data.icon active={activeCell === data.key} />
                          ) : undefined
                        }
                        active={activeCell === data.key}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ProtectedComponent>
        ))}
        <button
          onClick={() => dispatch(handleSetSidebarCollapse())}
          className={`flex items-center align-center bg-[white] rounded-r-md hover:bg-primary hover:bg-opacity-20 hover:text-primary ${collapse ? "bg-primary bg-opacity-20" : ""
            }`}
        >
          <SidebarCell
            name={!collapse && "Collapse"}
            icon={collapse ? <ArrowBigRight /> : <ArrowBigLeft />}
            active={collapse}
          />
        </button>
      </nav>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        moduleName={unauthorizedModule}
      />
    </div>
  );
}
