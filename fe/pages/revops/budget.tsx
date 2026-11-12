import { useRouter } from "next/router";
import { useEffect } from "react";
import Layout from "../../components/layout";
import RevopsBudget from "../../components/revops/budget/revops-budget";
import { getInitialRoute, hasAccess } from "../../utils/roleAccess";
import { getUserIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import { Role } from "../../utils/roles";

export default function Budget() {
  const router = useRouter();

  const userId = getUserIdFromToken();
  const role = getUserRoleFromToken() as Role;

  useEffect(() => {
    if (!hasAccess(role as Role, "REVOPS_BUDGET", "EDIT")) {
      const route = getInitialRoute(role, userId);
      route && router.push(route);
    }
  }, [role, router, userId]);

  return (
    <Layout>
      <RevopsBudget />
    </Layout>
  );
}
