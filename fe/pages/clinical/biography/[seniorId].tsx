import React from 'react'; 
import { useRouter } from "next/router";
import LeadTab from "../../../components/lead-tab";
import Loader from "../../../commonComponents/loader";

const ClinicalBiographyPage = () => {
  const router = useRouter();
  if (!router.isReady) return <Loader />;
  const seniorId = router?.query?.seniorId as string;

  if (!seniorId) {
    return (
      <div className="p-4 text-center text-gray-500">
        Senior not found!
      </div>
    );
  }

  return (
    <div className="bg-white h-screen">
      <LeadTab leadId={seniorId} />
    </div>
  );
};

export default ClinicalBiographyPage;
