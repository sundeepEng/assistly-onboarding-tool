import React from 'react';
import { useRouter } from "next/router";
import Layout from "../../../components/layout";
import NurseActions from "../../../components/nurse/nurse-actions";
import { useState, useContext, useEffect } from "react";
import { RoleContext } from "../../../components/role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import { getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";

// CRM Nurse Lead details page.
// Mirrors CRM PCG details page.
function NurseDetails() {
  const router = useRouter();
  const nurseID = router?.query?.nurseId as string;
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_NURSE", "EDIT"));
  }, [role]);

  return (
    <div className="bg-[white] h-screen">
      <Layout>
        {!router.isReady ? (
          <Loader />
        ) : roleAccess ? (
          <div>
            <NurseActions nurseID={nurseID} />
          </div>
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
}

export default NurseDetails;
