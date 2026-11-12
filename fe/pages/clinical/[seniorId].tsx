import React from 'react';  // Add this line
import { useRouter } from "next/router";
import ClinicalTabs from "../../components/clinical/clinicalTabs/clinical-tabs";
import Loader from "../../commonComponents/loader";

const SeniorDetailsPage = () => {
  const router = useRouter();
  if (!router.isReady) return <Loader />; // Ensure router is ready
  const SeniorID = router?.query?.seniorId as string;

  return (
    <div>
      <ClinicalTabs seniorID={SeniorID} />
    </div>
  );
};

export default SeniorDetailsPage;
