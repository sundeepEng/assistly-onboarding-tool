import { useRouter } from "next/router";
import { Lead } from "../components/leads-table";
import ContractIcon from "../public/icons/contract-icon";
import { useAppDispatch } from "../redux/hooks";
import { handleSetLeadActiveTab } from "../redux/slices/tab-slice";
import { leadActiveTabConstants, milestones } from "../utils/constants";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import PopoverComponent from "./popover-component";
import { useState } from "react";
import InitialContactIcon from "../public/icons/initial-contact-icon";
import OnboardIcon from "../public/icons/onboard-icon";
import { HomeTour } from "../components/home-tour";
import { ContractStatus } from "../utils/contractStatus";

// #E67E22 color for pending docs
interface StageProps {
  className?: string;
  data?: Lead;
}

const Stage: React.FC<StageProps> = ({ className = "", data }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const currentStage = data?.milestone;
  const [infoOpen, setinfoOpen] = useState(false);

  const stages = [
    {
      key: milestones.INITIAL_CONTACT,
      alt: "Initial Contact",
      popup: () => {
        const stageComplete = currentStage?.includes(
          milestones.INITIAL_CONTACT,
        );
        const color = stageComplete ? "#514CEB" : "gray";
        return (
          <div>
            <div className="flex">
              <InitialContactIcon color={color} />
            </div>
          </div>
        );
      },
    },
    {
      key: milestones.TOUR,
      alt: "Tour",
      popup: () => {
        const stageComplete = currentStage?.includes(milestones.TOUR);
        const color = stageComplete ? "#514CEB" : "gray";
        return (
          <div className="flex cursor-pointer">
            <HomeTour data={data} color={color} currentStage={currentStage} />
          </div>
        );
      },
    },
    {
      key: milestones.ON_BOARDING,
      alt: "Onboarding",
      popup: () => {
        const navigateLead = () => {
          if (data) {
            router.push(`/crm/${data?.userId}`);
          } else {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                "Failed to update the milestone. Please try again.",
              ),
            );
          }
        };
        const stageComplete = currentStage?.includes(milestones?.ON_BOARDING);
        const color = stageComplete ? "#514CEB" : "gray";
        return (
          <div onClick={() => navigateLead()}>
            {
              <div className="flex content-center cursor-pointer">
                <OnboardIcon color={color} />
              </div>
            }
          </div>
        );
      },
    },
    {
      key: milestones.CONTRACT,
      alt: "Contract",
      popup: () => {
        const navigateLead = () => {
          if (data) {
            router.push(`/crm/${data?.userId}`);
            dispatch(
              handleSetLeadActiveTab(leadActiveTabConstants.ACTIONS_TAB),
            );
          } else {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                "Failed to update the milestone. Please try again.",
              ),
            );
          }
        };
        const envelopeStatus =
          data?.onboardingESignEnvelopeStatus ?? data?.docusignEnvelopeStatus;

        const { docusignStatus, colorStatus } = ContractStatus(envelopeStatus);

        return (
          <div onClick={() => navigateLead()}>
            <PopoverComponent
              body={
                <div className="w-[300px] font-poppins">{docusignStatus}</div>
              }
              isOpen={infoOpen}
              setIsOpen={setinfoOpen}
              triggerOnHover={true}
            >
              <div className="cursor-pointer">
                <ContractIcon color={colorStatus} />
              </div>
            </PopoverComponent>
          </div>
        );
      },
    },
  ];
  return (
    <div>
      <div className={`flex flex-row gap-x-[7px] ${className}`}>
        {stages.map((stage, index) => (
          <div key={stage.key} className="flex items-center ">
            {stage?.popup()}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Stage;
