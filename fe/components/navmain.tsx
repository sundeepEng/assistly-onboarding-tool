import classNames from "classnames";
import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import ExceptionPopover from "../commonComponents/exception-popover";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { handleSetDashboardActiveTab } from "../redux/slices/dashboard-tab-slice";
import {
  handleClosePopover,
  handleHideCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import {
  handleSetCarePlanLeadActiveTab,
  handleSetLeadActiveTab,
} from "../redux/slices/tab-slice";
import {
  leadActiveTabConstants,
  leadCarePlanTabConstants,
  userRoles,
} from "../utils/constants";
import { Role } from "../utils/roles";
import Nav from "./nav";
import { ProtectedComponent } from "./protectedComponent";
import { RoleContext } from "./role-provider";
import { BookOpen } from "lucide-react";
import { getUserIdFromToken, getUserRoleFromToken } from "../utils/auth";
import { hasAccess } from "../utils/roleAccess";
import AssistlyLogo from "../public/icons/assistly";

export type NavmainType = {
  className?: string;
};

const Navmain: NextPage<NavmainType> = ({ className = "" }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const subPath = router?.pathname?.split("/");
  const contextRole = useContext(RoleContext)?.role;
  const userId = getUserIdFromToken();
  const [role, setRole] = useState<string | undefined>(contextRole);
  const [isRoleGuest, setIsRoleGuest] = useState(false);

  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
    setIsRoleGuest(finalRole === userRoles.COMPLIANCE_GUEST);
  }, [contextRole, router]);
  useEffect(() => {
    if (subPath?.length > 0) {
      dispatch(handleSetDashboardActiveTab(subPath[1]));
    }
  }, [subPath, dispatch]);

  const activeTab = useAppSelector(
    (state: { dashboardTab: { activeTab: string } }) =>
      state.dashboardTab.activeTab
  );
  const isPopoverVisible = useAppSelector(
    (state: { exceptionPopover: { isPopoverVisible: boolean } }) =>
      state.exceptionPopover.isPopoverVisible
  );
  const isError = useAppSelector(
    (state: { exceptionPopover: { popoverCloseOptions: boolean } }) =>
      state.exceptionPopover.popoverCloseOptions
  );
  const handleRoute = (route: string) => {
    dispatch(handleSetDashboardActiveTab(route));
    if (role === userRoles.SENIOR || role === userRoles.LEAD) {
      router.push(`/${route}/${userId}`);
    } else if (role === userRoles.PCGLEAD) {
      if (route != "compliance") {
        router.push(`/${route}/pcg/${userId}`);
      } else {
        router.push(`/${route}`);
      }
      //  need to add route for pcg
    } else if (role === userRoles.PCHO || role === userRoles.PCG) {
      router.push(`/${route}`);
    } else if (role === userRoles.SALES_DIRECTOR) {
      router.push(`/${route}`);
    }
    if (router) {
      dispatch(handleSetLeadActiveTab(leadActiveTabConstants.BIOGRAPHY_TAB));
      dispatch(
        handleSetCarePlanLeadActiveTab(leadCarePlanTabConstants.ADLS_TAB)
      );
    }
  };
  const getTabClass = (tabName: string) =>
    classNames({
      underline: activeTab === tabName,
      "no-underline": activeTab !== tabName,
    });
  // Set redux varaible of popover to flase to make it invisible
  useEffect(() => {
    if (isPopoverVisible && !isError) {
      const timer = setTimeout(() => {
        dispatch(handleClosePopover());
        dispatch(handleShowPopoverMessage(""));
        !isError && dispatch(handleHideCloseOptions());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isPopoverVisible]);

  const homeNavView = hasAccess(role as Role, "HOME_NAV", "EDIT");
  const crmNavView = hasAccess(role as Role, "CRM_NAV", "EDIT");
  const clinicalNavView = hasAccess(role as Role, "CLINICAL_NAV", "EDIT");
  const staffManagmentNavView = hasAccess(
    role as Role,
    "STAFF_MANAGEMENT_NAV",
    "EDIT"
  );
  const complianceNavView = hasAccess(role as Role, "COMPLIANCE_NAV", "EDIT");

  return (
    <header
      className={`h-[50px] bg-primary flex flex-row items-center justify-between flex-wrap content-center py-2.5 pl-[40px] pr-[100px] text-left text-xl text-grays-white font-poppins ${className}`}
    >
      <div className="flex flex-row items-center justify-start">
        {/* Temporarily Hamburger icon is not used, later will implement this!*/}
        {/* <Image
                    className="h-4 w-[19px] relative"
                    loading="lazy"
                    width={19}
                    height={16}
                    alt=""
                    src="/hamburger.svg"
                /> */}
        <div
          className={`h-[50px] cursor-pointer [text-decoration:none] relative font-bold text-[inherit] font-jakarta text-[22px]${homeNavView ? "cursor-pointer" : "cursor-not-allowed"
            }`}
          onClick={() => router.push("/")}
        >
          <div className="flex mb-8 font-[20px] gap-4 align-center items-center">
            <AssistlyLogo color={"white"} size={40} />
            <span className="flex text-[32px] font-semibold font-jakarta ">
              assistly
            </span>
          </div>
        </div>
        {/* {subPath[1] !== "" && (
          <>
            <ProtectedComponent
              role={role as Role}
              feature={"CRM_NAV"}
              access={["VIEW", "EDIT"]}
            >
              <div
                className={`flex flex-row items-center justify-center p-2.5 text-left text-xl text-grays-white font-poppins ${className} ${
                  crmNavView ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <div
                  className="h-[30px] w-[85.4px] relative"
                  onClick={() => handleRoute("crm")}
                >
                  <Image
                    className="absolute h-[93.33%] w-[33.37%] top-[3.33%] right-[66.63%] bottom-[3.33%] left-[0%] max-w-full overflow-hidden max-h-full"
                    loading="lazy"
                    width={29}
                    height={28}
                    alt=""
                    src="/icons/crm-icon.svg"
                  />
                  <a
                    className={`${getTabClass(
                      "crm"
                    )} absolute w-[54.8%] top-[0%] left-[45.2%] font-medium text-[inherit] inline-block`}
                  >
                    CRM
                  </a>
                </div>
              </div>
            </ProtectedComponent>

            <ProtectedComponent
              role={role as Role}
              feature={"CLINICAL_NAV"}
              access={["VIEW", "EDIT"]}
            >
              <div
                className={`flex flex-row items-center justify-center p-2.5 text-left text-xl text-grays-white font-poppins ${className} ${
                  clinicalNavView ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <div
                  className="h-8 w-[115.9px] relative  "
                  onClick={() => handleRoute("clinical")}
                >
                  <div className="absolute h-[93.75%] w-[66.7%] top-[6.25%] right-[0%] bottom-[0%] left-[33.3%] ">
                    <a
                      className={`${getTabClass(
                        "clinical"
                      )} absolute w-full top-[0%] left-[0%] font-medium text-[inherit] inline-block`}
                    >
                      Clinical
                    </a>
                  </div>
                  <Image
                    className="absolute h-[87.5%] w-[24.59%] top-[0%] right-[75.41%] bottom-[12.5%] left-[0%] max-w-full overflow-hidden max-h-full"
                    loading="lazy"
                    width={29}
                    height={28}
                    alt=""
                    src="/icons/clinical-icon.svg"
                  />
                </div>
              </div>
            </ProtectedComponent>

            <ProtectedComponent
              role={role as Role}
              feature={"STAFF_MANAGEMENT_NAV"}
              access={["VIEW", "EDIT"]}
            >
              <div
                className={`flex flex-row items-center justify-center p-2.5 text-left text-xl text-grays-white font-poppins ${className} ${
                  staffManagmentNavView
                    ? "cursor-pointer"
                    : "cursor-not-allowed"
                }`}
              >
                <div className="h-8  flex  " onClick={() => handleRoute("hcm")}>
                  <Image
                    className="w-[35px] h-[32px]"
                    loading="lazy"
                    width={29}
                    height={28}
                    alt=""
                    src="/images/hcm.png"
                  />
                  <div className="  ">
                    <a
                      className={`${getTabClass(
                        "hcm"
                      )}  w-full font-medium text-[inherit] inline-block`}
                    >
                      Staff Management
                    </a>
                  </div>
                </div>
              </div>
            </ProtectedComponent>

            <ProtectedComponent
              role={role as Role}
              feature={"COMPLIANCE_NAV"}
              access={["VIEW", "EDIT"]}
            >
              <div
                className={`flex flex-row items-center justify-center p-2.5 text-left text-xl text-grays-white font-poppins ${className} ${
                  complianceNavView ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <div
                  className="h-8 w-[160px] flex "
                  onClick={() => handleRoute("compliance")}
                >
                  <BookOpen className="h-6 w-6 text-primary m-[5px]" />
                  <div className="  ">
                    <a
                      className={`${getTabClass(
                        "compliance"
                      )}  w-full font-medium text-[inherit] inline-block`}
                    >
                      Compliance
                    </a>
                  </div>
                </div>
              </div>
            </ProtectedComponent>
          </>
        )} */}
      </div>
      <div className="">{isPopoverVisible && <ExceptionPopover />}</div>
      <Nav />
    </header>
  );
};

export default Navmain;
