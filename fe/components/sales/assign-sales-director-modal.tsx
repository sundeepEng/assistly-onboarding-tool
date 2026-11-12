import React, { useMemo } from "react";
import AssignUsersModal from "../../commonComponents/assign-users-modal";
import useGetAll from "../../services/getAll";
import { GetUsersPath, userRoles } from "../../utils/constants";
import { getHomeIdFromToken } from "../../utils/auth";

// Type for the sales director row data passed to this modal
type SalesDirectorRowLike = {
  userId?: string;
  id?: string;
  name?: string;
  associatedUserIds?:
    | string[]
    | Array<{ userId?: string; userName?: string; name?: string } | string>;
  [key: string]: any;
};

/**
 * AssignSalesDirectorModal - Wraps the common AssignUsersModal
 * to assign Sales Representatives to a Sales Director.
 * The modal fetches all Sales Representatives and lets the user
 * select which ones should be assigned to this director.
 * Enforces one-to-one: reps already assigned to another director are excluded.
 */
const AssignSalesDirectorModal = ({
  isOpen,
  setIsOpen,
  salesRep,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  salesRep: SalesDirectorRowLike;
}) => {
  const homeId = getHomeIdFromToken();
  const currentDirectorId = salesRep?.userId || salesRep?.id;

  // Fetch all Sales Directors to find reps already assigned to others
  const { data: directorsData } = useGetAll({
    key: userRoles.SALES_DIRECTOR,
    params: { userType: userRoles.SALES_DIRECTOR, homeId: homeId || "" },
    path: GetUsersPath,
  });

  // Collect rep IDs assigned to OTHER directors
  const excludeUserIds = useMemo(() => {
    const directors = (directorsData as any)?.users || [];
    const excluded: string[] = [];
    directors.forEach((director: any) => {
      const dirId = director?.userId || director?.id;
      if (dirId === currentDirectorId) return; // skip current director
      const assigned = director?.associatedUserIds || [];
      assigned.forEach((id: any) => {
        const repId = typeof id === "string" ? id : id?.userId || id?.id;
        if (repId) excluded.push(repId);
      });
    });
    return excluded;
  }, [directorsData, currentDirectorId]);

  return (
    <AssignUsersModal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      sourceUser={salesRep}
      excludeUserIds={excludeUserIds}
      config={{
        title: "Assign Sales Representatives",
        subtitle: (name) =>
          `Select which Sales Representatives ${name} will manage`,
        assignedSectionLabel: "Currently Assigned",
        allSectionLabel: "All Sales Representatives",
        countLabel: "representatives",
        assignableUserType: userRoles.SALES_REPRESENTATIVE,
        queryKey: "SALES_REPS_FOR_ASSIGN",
        successMessage: "Sales Representatives assigned successfully",
        errorMessage:
          "Not able to assign Sales Representatives, please try again",
        missingIdMessage:
          "Unable to update Sales Director: missing userId.",
      }}
    />
  );
};

export default AssignSalesDirectorModal;
