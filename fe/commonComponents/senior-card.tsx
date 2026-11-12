import type { NextPage } from "next";
import { useCallback } from "react";
import CircleComponent from "./circle-component";
import Avatar from "./avatar";
import HospitalIcon from "../public/icons/hospital-icon";
import HouseIcon from "../public/icons/house-icon";

export type CardType = {
  className?: string;
  seniorData: any;
};

const SeniorCard: NextPage<CardType> = ({ seniorData, className = "" }) => {
  const onCardContainerClick = useCallback(() => {
    // Handle click event for the card
  }, []);

  return (
    <div
      className={`h-[283px] w-[260px] rounded-[20px] bg-[white] flex flex-row items-center justify-start p-[20px] gap-6 cursor-pointer  ${className}`}
      onClick={onCardContainerClick}
    >
      <div className="flex flex-col gap-4 flex-1 items-center">
        <Avatar
          src={seniorData?.profileImageUrl}
          name={seniorData?.name}
          size={140}
          variant="bordered"
          alt="Senior Profile"
          className="!font-medium !text-[50px]"
        />
        <div className="w-full flex flex-col  items-center justify-between">
          <div className="h-[30px] text-md font-jakarta font-heading text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis w-[100px] font-semibold">
            {seniorData?.name}
          </div>
          <div className="flex justify-start items-start">
              <div className="">
                <div
                  className={`flex w-full gap-2 min-w-[130px] border-solid font-medium text-base px-4 py-2 cursor-pointer bg-primary bg-opacity-20 rounded-[20px] ${
                    seniorData?.clinical?.status
                      ?.toLowerCase()
                      ?.includes("house") ||
                    seniorData?.clinical?.status
                      ?.toLowerCase()
                      ?.includes("home")
                      ? " !text-primary"
                      : " text-primary"
                  }`}
                >
                  <div className="">
                    {seniorData?.clinical?.status
                      ?.toLowerCase()
                      ?.includes("hospital") ? (
                      <div>
                        <HospitalIcon active={true} />
                      </div>
                    ) : (
                      <div>
                        <HouseIcon active={true} />
                      </div>
                    )}
                  </div>
                  <div>
                    {seniorData?.clinical?.status
                      ? seniorData?.clinical?.status
                      : "Not Provided"}
                  </div>
                </div>
              </div>
          </div>
        </div>{" "}
      </div>
      
        <CircleComponent data={seniorData} />
    
    </div>
  );
};

export default SeniorCard;
