import React from "react";
import AssignUsersModal from "../../commonComponents/assign-users-modal";
import { userRoles } from "../../utils/constants";

// Type for the nurse row data passed to this modal
type NurseRowLike = {
  userId?: string;
  id?: string;
  name?: string;
  assignedSeniorIds?: string[];
  seniorIds?: string[];
  seniors?: Array<{ userId?: string; id?: string } | string>;
  associatedUserIds?:
    | string[]
    | Array<{ userId?: string; userName?: string; name?: string } | string>;
  [key: string]: any;
};

/**
 * AssignSeniorsModal - Wraps the common AssignUsersModal
 * to assign Seniors to a Nurse.
 * Configures labels, API params, and messages for the nurse-senior assignment flow.
 */
const AssignSeniorsModal = ({
  isOpen,
  setIsOpen,
  nurse,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  nurse: NurseRowLike;
}) => {
  return (
    <AssignUsersModal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      sourceUser={nurse}
      config={{
        title: "Assign Seniors",
        subtitle: (name) => `Select which seniors ${name} will care for`,
        assignedSectionLabel: "Currently Assigned",
        allSectionLabel: "All Seniors",
        countLabel: "seniors",
        assignableUserType: userRoles.SENIOR,
        queryKey: "SENIORS_FOR_ASSIGN",
        successMessage: "Seniors assigned successfully",
        errorMessage: "Not able to assign seniors, please try again",
        missingIdMessage: "Unable to update nurse: missing nurse userId.",
      }}
    />
  );
};

export default AssignSeniorsModal;
