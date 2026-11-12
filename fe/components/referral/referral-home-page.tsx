import React, { useContext, useState } from "react";
import Toggle from "../../commonComponents/toggle";
import ReferralTable from "./referral-table";
import CampaignTable from "./campaign-table";
import { hasAccess } from "../../utils/roleAccess";
import { RoleContext } from "../role-provider";
import { getUserRoleFromToken } from "../../utils/auth";
import { Role } from "../../utils/roles";
import { campaignType } from "../../utils/constants";

const ReferralHomePage = ({
  toggle,
  setToggle,
}: {
  toggle: boolean;
  setToggle: (toggle: boolean) => void;
}) => {
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const hasAccessResult = hasAccess(role as Role, "SMART_CRM", "EDIT");
  return (
    <div>
      {hasAccessResult ? (
        <>
          <Toggle
            toggelState={toggle}
            setToggleState={setToggle}
            state1="Contacts"
            state2="Campaign History"
            className="mb-4"
          />
          {!toggle ? (
            <div className="">
              <ReferralTable />
            </div>
          ) : (
            <div>
              <CampaignTable campaignType={campaignType.referral}/>
            </div>
          )}
        </>
      ) : (
        <ReferralTable />
      )}
    </div>
  );
};

export default ReferralHomePage;
