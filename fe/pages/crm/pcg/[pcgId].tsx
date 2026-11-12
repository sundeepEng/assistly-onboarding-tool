import React from 'react'; 
import { useRouter } from "next/router";
import Layout from "../../../components/layout";
import PCGActions from "../../../components/pcg/pcg-actions";
import { useState, useContext, useEffect } from "react";
import { RoleContext } from "../../../components/role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import { getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";

function PCGDetails() {
  const router = useRouter();
  const PCGID = router?.query?.pcgId as string;
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_PCG", "EDIT"));
  }, [role]);
  return (
    <div className="bg-[white] h-screen">
      <Layout>
        {!router.isReady ? (
          <Loader />
        ) : roleAccess ? (
          <div>
            <PCGActions pcgID={PCGID} />
          </div>
        ) : (
          <div><RestrictedPage/></div>
        )}
      </Layout>
    </div>
  );
}

export default PCGDetails;
