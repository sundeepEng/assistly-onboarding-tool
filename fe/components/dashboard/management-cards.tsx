import Button from "../../commonComponents/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../commonComponents/card";

import { useRouter } from "next/router";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { useContext } from "react";
import { getHomeIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import TickManagementIcon from "../../public/icons/tick-management-icon";
import CRMManagementIcon from "../../public/icons/crm-management-icon";
import ClinicalManagementIcon from "../../public/icons/clinical-managment-icon";
import StaffManagementIcon from "../../public/icons/staff-management-icon";
import ComplianceManagementIcon from "../../public/icons/compliance-management-icon";
import useGetById from "../../services/getById";
import { accessAllModules, homePath, salesDashboardPath } from "../../utils/constants";
import UpgradeModal from "../../commonComponents/upgrade-modal";
import { useState } from "react";
import RevopsManagementIcon from "../../public/icons/revops-management-icon";

export function ManagementCards() {
  const homeId = getHomeIdFromToken();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [unauthorizedModule, setUnauthorizedModule] = useState("");
  const { data: homeData } = useGetById({
    key: "home",
    payload: {
      id: homeId,
      path: homePath,
      enabled: !!homeId,
    },
  });

  const router = useRouter();

  const authorizedModules =
    homeData?.home?.authorizedModules || accessAllModules;
  const isSalesRequired = homeData?.home?.isSalesRequired ?? false;

  const managementSections = [
    {
      title: "CRM",
      description:
        "Track leads, manage family communication, and maintain resident relationships effectively",
      icon: <CRMManagementIcon />,
      color: "bg-steelblue",
      features: [
        "Lead Tracking",
        "Family Communication",
        "Follow-ups",
        "Notes & Logs",
      ],
      route: isSalesRequired ? salesDashboardPath : "/crm",
      rbacKey: "DASHBOARD_CRM_ACTION",
    },
    {
      title: "Clinical",
      description:
        "Monitor resident health records, medications, and wellness reports",
      icon: <ClinicalManagementIcon />,
      color: "bg-steelblue",
      features: [
        "Vitals Tracking",
        "Medication Logs",
        "Wellness Reports",
        "Health History",
      ],
      route: "/clinical",
      rbacKey: "DASHBOARD_CLINICAL_ACTION",
    },
    {
      title: "Staff Management",
      description:
        "Oversee caregiver schedules, training, and role assignments",
      icon: <StaffManagementIcon />,
      color: "",
      features: [
        "Shift Scheduling",
        "Training Logs",
        "Performance Notes",
        "Availability Tracking",
      ],
      route: "/hcm",
      rbacKey: "DASHBOARD_HCM_ACTION",
    },
    {
      title: "Compliance",
      description:
        "Ensure all documentation, inspections, and licenses meet regulatory standards",
      icon: <ComplianceManagementIcon />,
      color: "bg-purple-50 text-purple-600",
      features: [
        "Inspection Logs",
        "Incident Reports",
        "License Tracking",
        "Policy Updates",
      ],
      route: "/compliance",
      rbacKey: "DASHBOARD_COMPLIANCE_ACTION",
    },
    {
      title: "RevOps",
      description:
        "Manage billing, invoices, payments, and financial operations for your facility",
      icon: <RevopsManagementIcon />,
      color: "bg-purple-50 text-purple-600",
      features: [
        "Billing & Invoices",
        "Payment Management",
        "Revenue Reports",
        "Financial Analytics",
      ],
      route: "/revops",
      rbacKey: "DASHBOARD_COMPLIANCE_ACTION",
    },
  ];

  const contextRole = useContext(RoleContext)?.role;
  const cookieRole = getUserRoleFromToken();
  const finalRole = contextRole || cookieRole;

  const handleUnauthorizedClick = (moduleName: string) => {
    setUnauthorizedModule(moduleName);
    setShowUpgradeModal(true);
  };
  return (
    <div className="font-jakarta">
      <div>
        <div className="text-secondarymirage text-heading font-bold">
          Management Sections
        </div>
        <p className="text-s text-secondarymirage font-medium">
          Access key management areas for your facility
        </p>
      </div>

      <div className="flex flex-wrap grid-cols-[repeat(auto-fit,minmax(314px,1fr))] gap-4 mq1300:justify-center mt-[20px]">
        {managementSections.map((section) => {
          if (finalRole === "HomeAdmin" && section.title === "RevOps")
            return null;
          const featureKey = section.rbacKey;
          const canView = hasAccess(finalRole as Role, featureKey, "VIEW");
          const canEdit = hasAccess(finalRole as Role, featureKey, "EDIT");
          const isAuthorized = authorizedModules.includes(
            section.title.toUpperCase(),
          );

          if (!canView && !canEdit) return null;
          return (
            <Card
              key={section.title}
              className={`flex bg-white w-[314px] mq1024:w-[280px] h-[328px] p-[19px] flex-col rounded-[10px] ${!isAuthorized ? "opacity-50" : ""
                }`}
            >
              <CardHeader>
                <div className="flex flex-col justify-center gap-3">
                  <div className="flex gap-2">
                    <div
                      className={`flex justify-center items-center self-center rounded-lg px-[10px] py-[6px] bg-secondarylightgrayishblue`}
                    >
                      {section.icon}
                    </div>
                    <div className="flex">
                      <CardTitle className="flex justify-center">
                        <div className="flex items-center text-base font-jakarta font-semibold">
                          {section.title}
                        </div>
                      </CardTitle>
                    </div>
                  </div>
                  <div>
                    <CardDescription className="text-xs text-gray ">
                      {section.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col justify-between mt-2 grow">
                <div className="flex">
                  <div className="">
                    {section.features.map((feature) => (
                      <div className="flex">
                        <div>
                          <TickManagementIcon />
                        </div>
                        <div
                          key={feature}
                          className="text-s px-2 py-1 rounded whitespace-nowrap overflow-hidden text-ellipsis"
                        >
                          {feature}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  name={`Access ${section.title}`}
                  classname={`!text-white text-base font-semibold ${!isAuthorized ? "!bg-gray-400 hover:!bg-gray-400" : ""}`}
                  buttonClick={() => {
                    if (isAuthorized) {
                      router.push(section.route);
                    } else {
                      handleUnauthorizedClick(section.title);
                    }
                  }}
                  type="button"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        moduleName={unauthorizedModule}
      />
    </div>
  );
}
