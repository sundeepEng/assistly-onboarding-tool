import { useContext, useEffect, useMemo, useState } from "react";
import Tabs from "../commonComponents/tabs";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { handleSetLeadActiveTab } from "../redux/slices/tab-slice";
import useGetById from "../services/getById";
import { SENIOR, UserPath } from "../utils/constants";
import { hasAccess } from "../utils/roleAccess";
import { Role } from "../utils/roles";
import Actions from "./actions";
import BiographyFormWrapper from "./biography";
import Careplan from "./careplan";
import Layout from "./layout";
import MedicalFormWrapper from "./medical";
import { RoleContext } from "./role-provider";
import Loader from "../commonComponents/loader";
import { getUserRoleFromToken } from "../utils/auth";
import RestrictedPage from "../commonComponents/restricted";
import FaceSheet from "./face-sheet";

type LeadFormDataProps = {
  leadId: string; // Define the userId prop type
};

function LeadTab({ leadId }: LeadFormDataProps) {
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_BIOGRAPHY", ["EDIT","VIEW"]));
  }, [role]);
   const canViewDocuments = useMemo(
    () => hasAccess(role as Role, "CRM_BIOGRAPHY_DOCUMENTS",  "EDIT"),
    [role]
  );
  const {
    data: leadData,
    isLoading,
    error,
  } = useGetById({
    key: "userId",
    payload: { id: leadId, path: UserPath,enabled:!!leadId },
  });
const tabData = useMemo(() => {
    let tabs = [
      {
        label: "Biography",
        content: <BiographyFormWrapper leadData={leadData} />,
      },
      {
        label: "Medical",
        content: <MedicalFormWrapper medicalData={leadData} />,
      },
      {
        label: "Careplan",
        content: <Careplan careplanData={leadData} />,
      },
      {
        label: "Documents",
        content: <Actions leadData={leadData} />,
      },
    ];
    const isSenior = String(leadData?.role).toLowerCase() === "senior";
    if(isSenior){
        tabs.push(
      {
        label:"FaceSheet",
        content:<FaceSheet leadData={leadData}/>
      })
    }
    return canViewDocuments
      ? tabs
      : tabs.filter((t) => t.label !== "Documents");
  }, [leadData, canViewDocuments]);

  const leadDataActiveTab = useAppSelector(
    (state: { tab: { leadDataActiveTab: string } }) =>
      state.tab.leadDataActiveTab
  );
  const dispatch = useAppDispatch();

  const handleTabChange = (label: string) => {
    dispatch(handleSetLeadActiveTab(label));
  };
  
  return (
    <Layout>
      <div className="bg-[#FAFAFA] px-4">
        <div className="">
          {isLoading ? (
            <Loader />
          ) : roleAccess ? (
            <>
              <p className="text-heading font-bold font-jakarta">
                {leadData?.role==SENIOR ? "Senior" : "Senior Lead"} - {leadData?.name}
              </p>
              <Tabs
                tabs={tabData}
                containerClassName="rounded-t-[10px] pt-[5px]"
                activeTabClassName="text-[black] text-2xl"
                activeTab={leadDataActiveTab}
                onTabChange={handleTabChange}
              />
            </>
          ) : (
            <div>
              <RestrictedPage />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default LeadTab;
