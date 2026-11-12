import React from 'react';  // Add this at the top
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useState } from "react";
import CommonModal from "../../../commonComponents/common-modal";
import SeniorCard from "../../../commonComponents/senior-card";
import SeniorProfileCard from "../../../commonComponents/senior-profile-card";
import { Senior } from "../../../types/senior-types";
import Loader from "../../../commonComponents/loader";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { getUserRoleFromToken } from "../../../utils/auth";

interface SeniorsTableProps {
  data: any;
  customEmptyMessage?: string;
}

const SeniorGrid: NextPage<SeniorsTableProps> = ({
  data,
  customEmptyMessage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  if (!data) return <Loader />;
  const router = useRouter();

  // Check access for deleted seniors
  const role = getUserRoleFromToken();
  const accessDeletedSeniors = hasAccess(
    role as Role,
    "VIEW_DELETED_SENIORS",
    "EDIT",
  );

  // Filter data based on access: show all seniors if has access, otherwise show only non-deleted
  const filteredData = accessDeletedSeniors
    ? data // Show all seniors (both deleted and active)
    : data?.filter((senior: Senior) => !senior?.isDeleted); // Show only non-deleted seniors

  const handleCardClick = (user: any) => {
    setIsModalOpen(true);
    setSelectedUser(user);
  };

  if (!Array.isArray(filteredData) || filteredData?.length === 0) {
    return (
      <div className="p-4 text-[#9C9999] text-[25px] font-medium font-jakarta text-center">
        {customEmptyMessage || "Nothing added yet."}
      </div>
    );
  }

  return (
    <div className="flex items-center flex-wrap gap-y-4 gap-x-3">
      {filteredData?.map((user: any, index: number) => (
        <div
          key={index}
          onClick={() => handleCardClick(user)}
          className="cursor-pointer"
        >
          <SeniorCard
            seniorData={user}
            className={`${accessDeletedSeniors && user?.isDeleted ? "bg-[#bcb9b9] pointer-events-none cursor-not-allowed opacity-50" : ""}`}
          />
        </div>
      ))}
      <CommonModal
        modalOpen={isModalOpen}
        setModalOpen={setIsModalOpen}
        className="w-[675px]"
      >
        <div className="px-[20px]">
          {selectedUser && <SeniorProfileCard seniorData={selectedUser} />}
        </div>
      </CommonModal>
    </div>
  );
};

export default SeniorGrid;

interface SeniorProfileCardModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: Senior;
}

const SeniorProfileCardModal: React.FC<SeniorProfileCardModalProps> = ({
  isOpen,
  setIsOpen,
  user,
}) => {
  return (
    <CommonModal
      modalOpen={isOpen}
      setModalOpen={() => setIsOpen(false)}
      crossCTA={true}
      className="w-[675px]"
    >
      <div className="px-[20px]">
        {user && <SeniorProfileCard seniorData={user} />}
      </div>
    </CommonModal>
  );
};
