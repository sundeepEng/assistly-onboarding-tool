import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../../components/layout";
import PCGPortalDashboard from "../../components/revops/pcg/pcg-portal-dashboard";
import SeniorDashboard from "../../components/revops/billing-invoice/senior-dashboard";
import RestrictedPage from "../../commonComponents/restricted";
import { getInitialRoute, hasAccess } from "../../utils/roleAccess";
import { getUserIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import { Role } from "../../utils/roles";
import { useAuthorizedModules } from "../../utils/useAuthorizedModules";
import Loader from "../../commonComponents/loader";

export default function Index() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const userId = getUserIdFromToken();
  const role = getUserRoleFromToken() as Role;
  const authorizedModules = useAuthorizedModules();
  const hasRevopsAccess = authorizedModules.includes("REVOPS");

  const hasPCGAccess = hasAccess(role as Role, "PCG_REVOPS_DASHBOARD", "EDIT");
  const hasSeniorAccess = hasAccess(role as Role, "SENIOR_REVOPS_DASHBOARD", "EDIT");
  const shouldRedirectToBillingInvoice =
    hasRevopsAccess && !hasSeniorAccess && !hasPCGAccess;

  useEffect(() => {
    setIsMounted(true);
    if (!hasAccess(role as Role, "REVOPS_DASHBOARD", "EDIT")) {
      const route = getInitialRoute(role, userId);
      route && router.push(route);
      return;
    }
  }, [role, router, userId]);

  useEffect(() => {
    if (!isMounted) return;
    if (!shouldRedirectToBillingInvoice) return;
    router.replace("/revops/budget");
  }, [isMounted, router, shouldRedirectToBillingInvoice]);

  // Show loading state during SSR to prevent hydration mismatch
  if (!isMounted) {
    return (
      <Layout>
        <Loader fullScreen={false} />
      </Layout>
    );
  }

  return (
    <Layout>
      {hasRevopsAccess ? (
        hasSeniorAccess ? (
          <SeniorDashboard />
        ) : hasPCGAccess ? (
          <PCGPortalDashboard />
        ) : (
          // <RevopsDashboard /> Once we have API integration for revops dashboard we will uncomment this
          // <div className="px-[10px]">
          //   <ComingSoonCard />
          // </div>
          <Loader fullScreen={false} />
        )
      ) : (
        <RestrictedPage />
      )}
    </Layout>
  );
}
