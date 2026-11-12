import BaseTable from "../../commonComponents/base-table";
import useGetAll from "../../services/getAll";
import { AUDIENCE_LABELS, GetUsersPath, userRoles } from "../../utils/constants";
import ReferralCell from "./referral-cell";
import ReferralStatus from "./referral_status";
import Loader from "../../commonComponents/loader";
import { getHomeIdFromToken } from "../../utils/auth";
import ReferralActionCell from "./referral-action-cell";
import Button from "../../commonComponents/button";
import { useEffect, useState } from "react";
import CommonModal from "../../commonComponents/common-modal";
import CampaignModal from "./campaign-modal";
import { exportToCsv } from "../../utils/exportToCsv";

const ReferralTable = () => {
  const homeId = getHomeIdFromToken();
  const [activeBulkCampaign, setActiveBulkCampaign] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [resetSelectionKey, setResetSelectionKey] = useState(0);
  const [selectedReferrals, setSelectedReferrals] = useState<
    Array<{ id: string; email?: string; phone?: string; hasOptedOut?: boolean }>
  >([]);
  const handleSetCampaignModal = (open: boolean) => {
    setCampaignModal(open);

    if (!open) {
      setSelectedReferrals([]);
      setActiveBulkCampaign(false);
      setResetSelectionKey((prev) => prev + 1);
    }
  };

  const { data, isLoading } = useGetAll({
    key: userRoles.REFERRAL,
    params: {
      userType: userRoles?.REFERRAL,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const handleExportReferrals = () => {
    if (!data?.users || data.users.length === 0) {
      return;
    }

    const columns = [
      { header: "S.No", field: "sno" },
      { header: "Name", field: "name" },
      { header: "Email", field: "email" },
      { header: "Phone", field: "mobile" },
      { header: "Referral Agency", field: "referralOrgName" },
    ];

    exportToCsv(data.users, columns, "referrals.csv");
  };
  const columns = [
    {
      header: "Name",
      field: "name",
      render: (_value, data) => <ReferralCell name={data?.name} data={data} />,
      minWidth: "200px",
      headerClassName: "pl-[35px] text-xs font-medium ",
    },
    {
      header: "Email",
      field: "email",
      render: (value) => (
        <p
          className="m-0 truncate max-w-[180px] overflow-hidden whitespace-nowrap text-ellipsis"
          title={value}
        >
          {value?.length > 22
            ? value?.substring(0, 22) + "..."
            : value
            ? value
            : "-"}
        </p>
      ),
      minWidth: "260px",
      headerClassName: "pl-[10px] text-xs font-medium",
    },
    {
      header: "Phone",
      field: "mobile",
      render: (value) => <div>{value || "-"}</div>,
      minWidth: "170px",
      headerClassName: "pl-[5px] text-xs font-medium",
    },
    {
      header: "Referral Agency",
      field: "referralOrgName",
      render: (value) => <div>{value || "-"}</div>,
      minWidth: "150px",
      headerClassName: "pl-[5px] text-xs font-medium",
    },
    {
      header: "Status",
      field: "referralFollowupStatus",
      render: (value, user) => (
        <div>
          <ReferralStatus initialStatus={value} user={user} />
        </div>
      ),
      minWidth: "270px",
      headerClassName: "pl-[5px] text-xs font-medium",
    },
    {
      header: "",

      field: "actions",
      render: (_value: string, data) => <ReferralActionCell row={data} />,
      minWidth: "50px",
      headerClassName: "flex justify-end",
    },
  ];
  useEffect(() => {
    setActiveBulkCampaign(activeBulkCampaign);
  }, [activeBulkCampaign]);
  if (isLoading) return <Loader />;

  return (
    <div className="">
      <CommonModal
        modalOpen={campaignModal}
        setModalOpen={handleSetCampaignModal}
        crossCTA={true}
      >
        <div className="w-[600px]">
          <CampaignModal
            selectedReferrals={selectedReferrals}
            setCampaignModal={handleSetCampaignModal}
            campaignAudience={AUDIENCE_LABELS.referral}
          />
        </div>
      </CommonModal>
        <div className={`flex justify-end gap-3 pb-[20px] `} >
          <Button
            name={"Export Referrals"}
            buttonClick={handleExportReferrals}
            disabled={!data?.users || data.users.length === 0}
          />
          <Button
            name={"Send Bulk Campaign"}
            buttonClick={() => setCampaignModal(true)}
            disabled={!activeBulkCampaign}
          />
        </div>

      {data?.users?.length > 0 ? (
        <BaseTable
          columns={columns}
          data={data?.users}
          rowStyles={() => "h-[54px] "}
          cellStyles={(field, value, row) => 
            field === "actions" ? "justify-end h-full pr-[10px]" : "flex h-full"
          }
          tableContainerClass={" bg-white"}
          headerStyles="pt-[5px]"
          checkbox={true}
          setActiveBulkCampaign={setActiveBulkCampaign}
          onRowSelectionChange={setSelectedReferrals}
          resetSelectionKey={resetSelectionKey}
        />
      ) : (
        <p className="text-gray-500 text-lg font-medium font-poppins">
          No Referrals added yet.
        </p>
      )}
    </div>
  );
};
export default ReferralTable;
