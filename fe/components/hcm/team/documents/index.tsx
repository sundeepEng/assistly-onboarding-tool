import { useRouter } from "next/router";
import PCGActions from "../../../pcg/pcg-actions";
import { useContext, useEffect, useState } from "react";
import { RoleContext } from "../../../role-provider";
import { getUserRoleFromToken } from "../../../../utils/auth";
import { hasAccess } from "../../../../utils/roleAccess";
import { Role } from "../../../../utils/roles";
import RestrictedPage from "../../../../commonComponents/restricted";

const Documents = () => {
  const router = useRouter();
  const { userId } = router.query;
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(
      hasAccess(role as Role, "CLINICAL_PCG", "EDIT") &&
        hasAccess(role as Role, "CARE_TEAM_DOCUMENTS", "EDIT"),
    );
  }, [role]);
  return (
    <div className="min-h-[500px]">
      {roleAccess ? (
        <PCGActions pcgID={userId} isActionsNeeded={true} />
      ) : (
        <div className="">
          <RestrictedPage />
        </div>
      )}
    </div>
  );
};

export default Documents;
