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
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";
import { CLINICAL } from "../../../utils/constants";

// Clinical Nurse details page.
// Mirrors clinical PCG details page.
function NurseDetails() {
  const router = useRouter();
  const nurseID = router?.query?.nurseId as string;
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CLINICAL_NURSE", "EDIT"));
  }, [role]);

  const authorizedModules = useAuthorizedModules();
  const hasClinicalAccess = authorizedModules.includes(CLINICAL.toUpperCase());

  return (
    <div className="bg-[white] h-screen">
      <Layout>
        {!router.isReady ? (
          <Loader fullScreen={false} />
        ) : roleAccess && hasClinicalAccess ? (
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
