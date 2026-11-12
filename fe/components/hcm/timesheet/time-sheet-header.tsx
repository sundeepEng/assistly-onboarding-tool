import { NextPage } from "next";
import PayPeriodReview from "./pay-period-review";
import ViewTimeSheet from "./daily_review";
import { useContext, useState } from "react";
import Tabs from "../../../commonComponents/tabs";
import { hasAccess } from "../../../utils/roleAccess";
import { Access, Role } from "../../../utils/roles";
import { RoleContext } from "../../role-provider";
import { getUserRoleFromToken } from "../../../utils/auth";

interface TabData {
  label: string;
  content: JSX.Element;
  access?: { feature: string; type: Access }[];
}

const TimeSheetHeader = () => {
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const tabData: TabData[] = [
    {
      label: "Daily review",
      content: (
        <div>
          <ViewTimeSheet />
        </div>
      ),
      access: [{ feature: "HCM_DAILY_REVIEW", type: "EDIT" }],
    },
    {
      label: "Pay period review",
      content: (
        <div className="min-w-[1000px]">
          <PayPeriodReview />
        </div>
      ),
      access: [{ feature: "HCM_PAY_PERIOD_REVIEW", type: "EDIT" }],
    },
  ];

  const filteredTabData = tabData?.filter((data) =>
    data?.access?.some(({ feature, type }) =>
      hasAccess(role as Role, feature, type)
    )
  );

  const [activeTab, setActiveTab] = useState<string>(filteredTabData[0]?.label);

  return (
    <div className="flex flex-col">
      <div>
        <h2 className="text-2xl font-semibold text-[#2E2C34] px-4">
          Timesheets
        </h2>
      </div>
      <div>
        <Tabs
          tabs={filteredTabData}
          // containerClassName="w-[400px]"
          activeTabClassName="text-2xl"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          containerClassName="!bg-[#f4f4f4] border-b border-solid border-[#C8C8CC] mb-6"
        />
      </div>
    </div>
  );
};

export default TimeSheetHeader;

{
  /* <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#2E2C34]">Timesheets</h2>
        <div className="flex gap-6">
          <button className="text-sm font-medium text-[#2E2C34] border-b-[2px] border-[#7A52E3] pb-1">
            Daily review
          </button>
          <button className="text-sm font-medium text-[#7A52E3] pb-1 hover:opacity-80">
            Pay period review
          </button>
        </div>
      </div> */
}
