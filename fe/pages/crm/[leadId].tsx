// This file [leadId].tsx tells Next.js to dynamically handle routes
import React from 'react'; 
import { useRouter } from "next/router";
import LeadTab from "../../components/lead-tab";
import Loader from "../../commonComponents/loader";

function LeadDetailPage() {
    const router = useRouter();
    if (!router.isReady) return <Loader/>; // Ensure router is ready
    const leadID = router.query.leadId as string;
    return (
        <div className="bg-[white] h-screen">
            <LeadTab leadId={leadID} />
        </div>
    );
}

export default LeadDetailPage;
