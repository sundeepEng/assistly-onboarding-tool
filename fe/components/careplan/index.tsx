import Tabs from "../../commonComponents/tabs";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { handleSetCarePlanLeadActiveTab } from "../../redux/slices/tab-slice";
import Adl from "./adls";
import Physicalhealth from "./physical-health";

function Careplan({ careplanData }: any) {
  const tabData = [
    {
      label: "ADL’S",
      content: (
        <div>
          <Adl careplanData={careplanData} />
        </div>
      ),
    },
    {
      label: "Overall Health",
      content: (
        <div className="">
          <Physicalhealth careplanData={careplanData} />
        </div>
      ),
    },
  ];

  const leadCarePlanActiveTab = useAppSelector(
    (state: { tab: { leadCarePlanActiveTab: string } }) =>
      state.tab.leadCarePlanActiveTab,
  );
  const dispatch = useAppDispatch();

  const handleTabChange = (label: string) => {
    dispatch(handleSetCarePlanLeadActiveTab(label));
  };

  return (
    <div className="flex bg-[F6F6F6] justify-center pt-4">
      <div className="flex">
        <Tabs
          tabs={tabData}
          containerClassName="rounded-t-[10px] pt-[5px] !items-center !bg-transparent !justify-center"
          tabHeadingClassName="items-center w-full !bg-transparent justify-center"
          activeTabClassName="text-primary text-2xl"
          activeTab={leadCarePlanActiveTab}
          onTabChange={handleTabChange}
          tabTextClassName={"px-[60px]"}
        />
      </div>
    </div>
  );
}

export default Careplan;
