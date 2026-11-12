import React from "react";
import { Card, CardDescription } from "../../commonComponents/card";
import {
  ESIGN_ENVELOPE_STATUS_PENDING,
  ESIGN_ENVELOPE_STATUS_DECLINED,
  ESIGN_ENVELOPE_STATUS_ERROR,
  homePath,
  accessAllModules,
  CLINICAL,
} from "../../utils/constants";
import { getDocusignStatusBadge } from "../../utils/dashboardUtils";
import { getHomeIdFromToken } from "../../utils/auth";
import { useAuthorizedModules } from "../../utils/useAuthorizedModules";

type User = {
  userId?: string;
  email?: string;
  name: string;
  docusignEnvelopeStatus?: string;
  onboardingESignEnvelopeStatus?: string;
};

type UsersData = {
  leads?: { users?: User[] };
  seniors?: { users?: User[] };
  PCGLeads?: { users?: User[] };
  PCGs?: { users?: User[] };
};

function PendingContracts({ usersData }: { usersData?: UsersData }) {
  const LoggedInUserhomeId = getHomeIdFromToken();
  const authorizedModules = useAuthorizedModules();
  const hasClinical = authorizedModules.includes(CLINICAL.toUpperCase());

  // Literal Tailwind classes so the JIT picks them up
  const colorClassByKey: Record<string, string> = {
    [ESIGN_ENVELOPE_STATUS_DECLINED]:
      "bg-[#FEDFDF] text-[#930301] bg-opacity-80",
    [ESIGN_ENVELOPE_STATUS_PENDING]: "bg-yellow-500",
    [ESIGN_ENVELOPE_STATUS_ERROR]: "bg-[#DC3545]",
    default: "bg-yellow-400",
  };

  const baseGroups = [
    { key: "leads" as const, label: "Senior Leads" },
    { key: "PCGLeads" as const, label: "Care Leads" },
  ];

  const conditionalGroups = hasClinical
    ? [
        { key: "seniors" as const, label: "Seniors" },
        { key: "PCGs" as const, label: "Care Team" },
      ]
    : [];

  const groups: Array<{ key: keyof UsersData; label: string }> = [
    ...baseGroups,
    ...conditionalGroups,
  ];

  const renderGroup = (groupKey: keyof UsersData, title: string) => {
    const groupUsers = usersData?.[groupKey]?.users ?? [];

    // Build visible list first (skip completed/undefined badge)
    const visibleUsers = groupUsers
      .map((user) => {
        // Check both docusignEnvelopeStatus and onboardingESignEnvelopeStatus
        const docusignBadge = getDocusignStatusBadge(
          user.docusignEnvelopeStatus,
        );
        const onboardingBadge = getDocusignStatusBadge(
          user.onboardingESignEnvelopeStatus,
        );

        // Use whichever badge exists (prioritize onboarding if both exist)
        const badge = onboardingBadge || docusignBadge;
        if (!badge) return null;

        // Use the corresponding status
        const status =
          user.onboardingESignEnvelopeStatus ||
          user.docusignEnvelopeStatus ||
          "default";
        const colorClass = colorClassByKey[status] ?? colorClassByKey.default;
        return { user, badge, colorClass };
      })
      .filter(Boolean) as Array<{
      user: User;
      badge: { label: string; color: string; notes: string };
      colorClass: string;
    }>;

    // If nothing to show, render nothing (no heading)
    if (visibleUsers.length === 0) return null;

    return (
      <div
        key={String(groupKey)}
        className="mt-[10px] w-[314px] h-auto border border-solid border-secondarylightgrayish rounded-[10px] "
      >
        <div className="font-semibold px-[10px] py-[5px]">{title}</div>
        <div className="flex flex-col">
          {visibleUsers.map(({ user, badge, colorClass }) => (
            <div
              key={user.userId || user.email || user.name}
              className="p-3 border-t border-secondarylightgrayish border-solid flex items-center justify-between"
            >
              <div className="flex flex-col">
                <div className="flex-1 text-primary font-medium">
                  {user.name}
                </div>
                <div className="flex text-xs">{badge.notes}</div>
              </div>
              <div
                className={`flex justify-center p-[5px] items-center h-[22px] font-medium rounded-[5px] text-xs ${colorClass} `}
              >
                {badge.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Check if there are any visible users in any group
  const hasAnyPending = groups?.some((group) => {
    const groupUsers = usersData?.[group.key]?.users ?? [];
    return groupUsers.some((user) =>
      getDocusignStatusBadge(user?.docusignEnvelopeStatus),
    );
  });

  return (
    <div className="font-jakarta">
      <Card className="p-6 mq1300:p-0 bg-white shadow-md rounded-lg">
        <CardDescription className="p-[10px]">
          <div className=" font-medium text-lg text-primary">
            Pending Contracts
          </div>
          <div className="flex flex-wrap grid-cols-[repeat(auto-fit,minmax(314px,1fr))] gap-4 mq1300:justify-center">
            {groups.map((group) => renderGroup(group.key, group.label))}
          </div>
        </CardDescription>
      </Card>
    </div>
  );
}

export default PendingContracts;
