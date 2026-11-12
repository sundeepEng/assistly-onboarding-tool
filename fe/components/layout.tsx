import { ReactNode, useContext, useEffect, useState } from "react";
import Sidebar from "../commonComponents/sidebar";
import Footer from "../components/footer";
import { hasAccess } from "../utils/roleAccess";
import { Role } from "../utils/roles";
import Navmain from "./navmain";
import { ProtectedComponent } from "./protectedComponent";
import { RoleContext } from "./role-provider";
import { CRM, userRoles, homePath } from "../utils/constants";
import { useAppSelector } from "../redux/hooks";
import ChatPopup from "./chat/chat-popup";
import { getUserRoleFromToken, getHomeIdFromToken, setIsSalesRequiredInCookie } from "../utils/auth";
import { isEmbedded } from "../utils/gia/embed";
import { useRouter } from "next/router";
import useGetById, { fetchById } from "../services/getById";

type LayoutProps = {
  children: ReactNode;
  sidebar?: boolean;
};

const Layout: React.FC<LayoutProps> = ({ children, sidebar = true }) => {
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  const collapse = useAppSelector(
    (state: { sidebarCollapse: { collapse: boolean } }) =>
      state.sidebarCollapse.collapse,
  );

  useEffect(() => {
    setIsMounted(true);
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
    
    // Refresh isSalesRequired from API on page load
    const homeId = getHomeIdFromToken();
    if (homeId) {
      fetchById({ id: homeId, path: homePath })
        .then((homeData) => {
          const isSalesRequired = homeData?.home?.isSalesRequired ?? false;
          setIsSalesRequiredInCookie(isSalesRequired);
        })
        .catch((error) => {
          console.error("Error fetching home data:", error);
        });
    }
  }, [contextRole]);
  const activeTab = useAppSelector(
    (state: { dashboardTab: { activeTab: string } }) =>
      state.dashboardTab.activeTab,
  );
  const isSidebarNeeded =
    hasAccess(role as Role, "CRM_SIDENAV", "EDIT") &&
    !(role === userRoles.PCG && activeTab === CRM);

  const subPath = router?.pathname?.split("/");

  return (
    <div>
      <div className="flex flex-col">
        {/* Navbar */}
        <div className="sticky top-0 z-10 h-[50px]">
          <Navmain />
        </div>

        <div className="flex flex-1">
          {/* Sidebar */}
          {isMounted && sidebar && isSidebarNeeded && !isEmbedded() && (
            <ProtectedComponent
              role={role as Role}
              feature="CRM_SIDENAV"
              access="EDIT"
            >
              <aside
                className={`sticky top-[50px] mq726:w-[200px] pt-[20px] ${
                  collapse ? "w-[75px]" : "w-[275px]"
                } flex-shrink-0`}
              >
                <Sidebar />
              </aside>
            </ProtectedComponent>
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto min-h-screen px-[20px] py-[20px] bg-secondarywildsand">
            {children}
            {isSidebarNeeded && subPath[1] !== "" && <ChatPopup />}
          </main>
        </div>
      </div>
      <div className="w-full bottom-0 z-10 shadow-[0px_0px_10px_0px_rgba(0,0,0,0.1)]">
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
