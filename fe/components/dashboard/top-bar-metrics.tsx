import { Users, Plus, BedSingleIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../commonComponents/card";
import { useContext, useMemo } from "react";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenAddLeadModal,
  handleOpenAddNurseModal,
  handleOpenAddPCGModal,
  handleOpenAddReferralModal,
} from "../../redux/slices/modal-slice";
import { RoleContext } from "../role-provider";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import ReferralIcon from "../../public/icons/referral-icon";
import PcgIcon from "../../public/icons/pcg-icon";
import {
  calculateMonthlyTrend,
  GetHomeOccupancyRateTrend,
} from "../../utils/dashboardUtils";
import useGetById from "../../services/getById";
import { accessAllModules, CLINICAL, homePath, PCG } from "../../utils/constants";
import { getHomeIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import LeadsMetricsIcon from "../../public/icons/leads-metrics-icon";
import PlusIcon from "../../public/icons/plus-icon";
import SeniorMetricsIcon from "../../public/icons/senior-metrics-icon";
import ReferralMetricsIcon from "../../public/icons/referral-metrics-icon";
import PCGMetricsIcon from "../../public/icons/pcg-metrics-icon";
import PCGLeadMetricsIcon from "../../public/icons/pcg-lead-metrics-icon";
import { useRouter } from "next/router";
import NurseIcon from "../../public/icons/nurse-icon";
import NurseLeadIcon from "../../public/icons/nurse-lead-icon";

type UserGroup = {
  users?: any[];
  [key: string]: any;
};

type UsersData = {
  leads?: UserGroup;
  seniors?: UserGroup;
  referrals?: UserGroup;
  PCGLeads?: UserGroup;
  PCGs?: UserGroup;
  nurseLeads?: UserGroup;
  nurses?: UserGroup;
  [key: string]: UserGroup | undefined;
};

export function TopBarMetrics({ usersData }: { usersData: UsersData }) {
  const dispatch = useAppDispatch();
  const router = useRouter()
  const role = getUserRoleFromToken()
  // Calculate trends for each group
  const trendData = useMemo(() => {
    return Object.fromEntries(
      Object.entries(usersData).map(([key, data]) => [
        key,
        calculateMonthlyTrend((data as UserGroup)?.users || []),
      ])
    );
  }, [usersData]);

  const homeId = getHomeIdFromToken();
  const { data: homeData } = useGetById({
    key: "home",
    payload: {
      id: homeId,
      path: homePath,
      enabled: !!homeId
    },
  });

  const authorizedModules = homeData?.home?.authorizedModules || accessAllModules;

  const hasClinical = authorizedModules.includes(CLINICAL.toUpperCase());

  const seniors = usersData.seniors?.users || [];
  const homeCapacity = homeData?.home?.homeCapacity || 0;
  const occupancyRate = GetHomeOccupancyRateTrend(seniors, homeCapacity);

  // Stats definition
  const stats = useMemo(
    () => [
      {
        title: "Senior Leads",
        value: usersData.leads?.users?.length ?? 0,
        description: "Seniors awaiting approval",
        icon: LeadsMetricsIcon,
        trend: trendData.leads?.label,
        trendUp: trendData.leads?.trendUp,
        isPlusIconNeeded: true,
        rbacKey: "DASHBOARD_PENDING_APPLICATIONS",
        route: "/crm"
      },
      ...(hasClinical ? [{
        title: "Seniors",
        value: usersData.seniors?.users?.length ?? 0,
        description: "Active residents",
        icon: SeniorMetricsIcon,
        trend: trendData.seniors?.label,
        trendUp: trendData.seniors?.trendUp,
        isPlusIconNeeded: false,
        rbacKey: "DASHBOARD_CURRENT_RESIDENTS",
        route: "/clinical"
      }] : []),
      {
        title: "Referral Agents",
        value: usersData.referrals?.users?.length ?? 0,
        description: "Active referrals agents",
        icon: ReferralMetricsIcon,
        trend: trendData.referrals?.label,
        trendUp: trendData.referrals?.trendUp,
        isPlusIconNeeded: true,
        rbacKey: "DASHBOARD_REFERRALS",
        route: "/crm/referral"
      },
      {
        title: "Care Leads",
        value: usersData.PCGLeads?.users?.length ?? 0,
        description: "Caregivers pending review",
        icon: PCGLeadMetricsIcon,
        trend: trendData.PCGLeads?.label,
        trendUp: trendData.PCGLeads?.trendUp,
        isPlusIconNeeded: true,
        rbacKey: "DASHBOARD_STAFF_APPLICATIONS",
        route: "/crm/pcg"
      },
      ...(hasClinical ? [{
        title: "Care Team",
        value: usersData.PCGs?.users?.length ?? 0,
        description: "Current staff members",
        icon: PCGMetricsIcon,
        trend: trendData.PCGs?.label,
        trendUp: trendData.PCGs?.trendUp,
        isPlusIconNeeded: false,
        rbacKey: "DASHBOARD_ACTIVE_EMPLOYEES",
        route: `${role == PCG ? "/hcm/team" : "/clinical/pcg"}`
      }] : []),
      {
        title: "Nurse Leads",
        value: usersData.nurseLeads?.users?.length ?? 0,
        description: "Nurses pending review",
        icon: NurseLeadIcon,
        trend: trendData.nurseLeads?.label,
        trendUp: trendData.nurseLeads?.trendUp,
        isPlusIconNeeded: true,
        rbacKey: "DASHBOARD_STAFF_APPLICATIONS",
        route: "/crm/nurse"
      },
      {
        title: "Nurses",
        value: usersData.nurses?.users?.length ?? 0,
        description: "Active nurses",
        icon: NurseIcon,
        trend: trendData.nurses?.label,
        trendUp: trendData.nurses?.trendUp,
        isPlusIconNeeded: false,
        rbacKey: "DASHBOARD_STAFF_APPLICATIONS",
        route: "/clinical/nurse"
      },

      // commented out code as requirement
      // {
      //   title: "Occupancy Rate",
      //   value: occupancyRate.currentRate + "%",
      //   description: "Current capacity",
      //   icon: BedSingleIcon,
      //   trend: occupancyRate.label,
      //   trendUp: occupancyRate.trendUp,
      //   isPlusIconNeeded: false,
      //   rbacKey: "DASHBOARD_OCCUPANCY",
      // },
    ].flat(),
    [usersData, trendData, occupancyRate, homeCapacity, hasClinical]
  );

  const handleAddUser = (userType: string) => {
    if (userType === "Senior Leads") {
      dispatch(handleOpenAddLeadModal());
    }
    if (userType === "Referral Agents") {
      dispatch(handleOpenAddReferralModal());
    }
    if (userType === "Care Leads") {
      dispatch(handleOpenAddPCGModal());
    }
    if (userType === "Nurse Leads") {
      dispatch(handleOpenAddNurseModal());
    }
  };

  const contextRole = useContext(RoleContext)?.role;
  const cookieRole = getUserRoleFromToken();
  const finalRole = contextRole || cookieRole;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 mq1024:flex mq1024:justify-center mq1024:flex-wrap">
      {stats.map((stat) => {
        const featureKey = stat.rbacKey;
        const canView = hasAccess(finalRole as Role, featureKey, "VIEW");
        const canEdit = hasAccess(finalRole as Role, featureKey, "EDIT");

        if (!canView && !canEdit) return null;
        return (
          <Card
            key={stat.title}
            className="rounded-[10px] min-w-[200px] w-auto  h-[200px] p-[19px] bg-[white]"
          >
            <CardHeader className=" ">
              <div className="flex justify-between">
                <div className="flex flex-1 flex-col">
                  <div>
                    <CardTitle
                      className="text-base font-medium truncate whitespace-nowrap overflow-hidden text-ellipsis"
                      title={stat.title}
                    >
                      {stat.title}
                    </CardTitle>
                  </div>
                  <div className="flex justify-start text-20xl font-bold text-primary cursor-pointer" onClick={() => { router.push(stat.route) }}>
                    {stat.value}
                  </div>
                </div>
                <div className="flex flex-1 justify-end items-start !h-full">
                  <stat.icon />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-s font-medium font-jakarta !my-[10px]">
                {stat.description}
              </p>
              <p
                className={`text-s font-jakarta !my-[10px] ${stat.trendUp ? "text-green-600" : "text-red-600"
                  }`}
              >
                {stat.trend}
              </p>

              {/* Plus icon in bottom right */}
              {stat.isPlusIconNeeded && (
                <div
                  className="absolute -bottom-2 right-0 flex rounded-3xl justify-center items-center bg-primary bg-opacity-10 w-[39px] h-[39px] cursor-pointer"
                  onClick={() => handleAddUser(stat.title)}
                >
                  <PlusIcon color="#514ceb" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
