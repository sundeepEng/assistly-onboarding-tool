import { useRouter } from "next/router";
import { useEffect } from "react";
import Layout from "../../components/layout";
import RevopsPayroll from "../../components/revops/payroll/revops-payroll";
import PCGMyPayroll from "../../components/revops/pcg/pcg-my-payroll";
import { getInitialRoute, hasAccess } from "../../utils/roleAccess";
import { getUserIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import { Role } from "../../utils/roles";

export default function Payroll() {
  const router = useRouter();

  const userId = getUserIdFromToken();
  const role = getUserRoleFromToken() as Role;
  const isPCG = role === "PCG";

  useEffect(() => {
    if (!hasAccess(role as Role, "REVOPS_PAYROLL", "EDIT")) {
      const route = getInitialRoute(role, userId);
      route && router.push(route);
    }
  }, [role, router, userId]);

  return (
    <Layout>
      {isPCG ? <PCGMyPayroll /> : <RevopsPayroll />}
    </Layout>
  );
}
