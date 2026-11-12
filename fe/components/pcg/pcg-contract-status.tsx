import { useRouter } from "next/router";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import {
  CRM,
} from "../../utils/constants";
import PopoverComponent from "../../commonComponents/popover-component";
import { useState } from "react";
import ContractIcon from "../../public/icons/contract-icon";
import { ContractStatus } from "../../utils/contractStatus";

const PCGContractStatus = ({ data }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [infoOpen, setinfoOpen] = useState(false);

  const navigateLead = () => {
    if (data?.userId) {
      router.push(`/${CRM}/pcg/${data.userId}`);
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("PCG data not found"));
    }
  };


  const envelopeStatus =
    data?.onboardingESignEnvelopeStatus ?? data?.docusignEnvelopeStatus;
const {docusignStatus,colorStatus}=ContractStatus(envelopeStatus)


  const color = colorStatus ? colorStatus : "#808080";
  return (
    <div onClick={() => navigateLead()}>
      <PopoverComponent
        body={<div className="w-[300px] font-poppins">{docusignStatus}</div>}
        isOpen={infoOpen}
        setIsOpen={setinfoOpen}
        triggerOnHover={true}
      >
        <div className="cursor-pointer">
          <ContractIcon color={color} />
        </div>
      </PopoverComponent>
    </div>
  );
};

export default PCGContractStatus;
