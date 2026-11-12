import React, { useContext } from 'react'
import { RoleContext } from './role-provider';
import { getUserRoleFromToken } from '../utils/auth';
import { hasAccess } from '../utils/roleAccess';
import { Role } from '../utils/roles';
import Toggle from '../commonComponents/toggle';
import LeadsTable from './leads-table';
import CampaignTable from './referral/campaign-table';
import { campaignType } from '../utils/constants';

const LeadsHomePage = ({
  toggle,
  setToggle,
  milestoneFilter = "",
}: {
  toggle: boolean;
  setToggle: (toggle: boolean) => void;
  milestoneFilter?: string;
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
              <LeadsTable milestoneFilter={milestoneFilter} />
            </div>
          ) : (
            <div>
              <CampaignTable campaignType={campaignType.senior} />
            </div>
          )}
        </>
      ) : (
        <LeadsTable milestoneFilter={milestoneFilter} />
      )}
    </div>
  );
};

export default LeadsHomePage
