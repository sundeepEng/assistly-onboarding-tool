import React from "react";
import BaseTable from "../../commonComponents/base-table";
import useGetById from "../../services/getById";
import { getHomeIdFromToken } from "../../utils/auth";
import { homePath, UserPath } from "../../utils/constants";
import { dateFormat } from "../../utils/dateUtils";
import useCommentUsers from "../../utils/useCommentUsers";

const CampaignTable = ({campaignType}:{campaignType}) => {
  const homeId = getHomeIdFromToken();
  const { data: homeData } = useGetById({
    key: "homeId",
    payload: {
      id: homeId,
      path: homePath,
      enabled: !!homeId,
    },
  });
  const campaignCreatedUserIds = homeData?.home?.campaigns?.map(
    (campaign) => campaign.campaignCreatedByUserId,
  );
  const { userMap, isLoading } = useCommentUsers({
    userIds: campaignCreatedUserIds,
    path: UserPath,
  });
  const columns = [
    {
      header: "Channel",
      field: "campaignChannel",
      render: (_value, data) => <div className="pl-[20px]">{_value}</div>,
      minWidth: "200px",
      headerClassName: "pl-[20px] text-xs font-medium",
    },
    {
      header: "Subject/Message",
      field: "subject",
      render: (value, data) => {
        const subject = data?.campaignMetadata?.subject || "";
        return (
          <p
            className="m-0 truncate max-w-[180px] overflow-hidden whitespace-nowrap text-ellipsis"
            title={value}
          >
            {subject?.length > 30
              ? subject?.substring(0, 30) + "..."
              : subject
                ? subject
                : "-"}
          </p>
        );
      },
      minWidth: "200px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Receipents",
      field: "receipents",
      render: (value, data) => {
        const users = data?.campaignUsers || "";
        return <div>{users?.length || "-"}</div>;
      },
      minWidth: "200px",
      headerClassName: " text-xs font-medium",
    },
    {
      header: "Status",
      field: "status",
      render: (value, data) => {
        const createdAt = data?.createdAt?.split("T")[0];
        return <div>{dateFormat(createdAt) || ""}</div>;
      },
      minWidth: "100px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Sent",
      field: "sent",
      render: (value, user) => (
        <div className="bg-green-300 text-[green] px-[5px] bg-opacity-30 rounded-md text-[14px]">
          Sent
        </div>
      ),
      minWidth: "100px",
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Created By",

      field: "createdby",
      render: (_value: string, data) => {
        const createdUser=userMap[data.campaignCreatedByUserId]
        return (<div>{createdUser?.name}</div>)
      },
      minWidth: "50px",
      headerClassName: "text-xs font-medium",
    },
  ];
  const campaignData =
  homeData?.home?.campaigns?.filter(
    (campaign: any) => campaign.campaignType === campaignType,
  ) ?? [];
  return (
    <div>
        <BaseTable
          columns={columns}
          data={campaignData}
          rowStyles={() => "h-[54px]"}
          cellStyles={(field) =>
            field === "actions" ? "flex justify-end items-end pr-[10px] h-full" : "h-full"
          }
          tableContainerClass={" bg-white"}
          headerStyles="pt-[5px]"
        />
    </div>
  );
};

export default CampaignTable;
