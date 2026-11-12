"use client";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import Button from "../../../commonComponents/button";
import useUpdateShift from "../../../services/hcm-update-shift";
import { omit } from "../../../utils/dateUtils";
import { formatToLocalLongDate } from "../utils/timeUtils";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { HCM_SHIFT_OMIT_FIELDS } from "../../../utils/constants";

type CollapsibleCardProps = {
  title: string;
  items: any[];
};

const ReviewTimeOffCard = ({ title, items }: CollapsibleCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate } = useUpdateShift();
  const dispatch = useAppDispatch();

  const handleTimeOffStatusClick = (shift, status) => {
    const updatedShiftData = {
      ...shift,
      is_unavailability_approved: status,
      pay_rate: Number(shift.pay_rate),
    };
    const finalShiftData: any = omit(updatedShiftData, HCM_SHIFT_OMIT_FIELDS);
    mutate(finalShiftData, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            `Timeoff ${status ? "Approved" : "Rejected"} successfully`
          )
        );
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            `Error ${status ? "approving" : "rejecting"} timeoff : ${
              error?.response?.data?.message || "Something Went Wrong"
            }`
          )
        );
      },
    });
  };

  return (
    <div className="bg-white w-full font-jakarta">
      <div
        className="flex justify-between items-center cursor-pointer  rounded border-b border-secondarylightgrayish border-solid"
        onClick={() => setIsOpen(!isOpen)}
      >
        <p className="text-[14px] font-[500] text-black m-0">{title}</p>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {isOpen && (
        <div className="mt-3 space-y-4 ">
          {items?.map((item, index) => (
            <div key={index} className="border-b border-secondarylightgrayish border-solid">
              <div className="flex flex-col">
                <div>
                  <p className="font-semibold text-[16px] m-0 font-jakarta text-primary">
                    {item.user_name}
                  </p>
                </div>
                <div className="flex mt-2 mb-2 justify-between">
                <div>
                  <p className="text-[14px] m-0 font-jakarta font-medium text-[#818183]">
                    {item.unavailability_reason}
                  </p>
                  <p className="text-[14px] m-0 font-jakarta font-medium text-[#818183]">
                    {item?.shift_start_time.split("T")[0] ===
                    item?.shift_end_time.split("T")[0]
                      ? formatToLocalLongDate(item.shift_start_time)
                      : `${formatToLocalLongDate(
                          item.shift_start_time
                        )} - ${formatToLocalLongDate(item.shift_end_time)}`}
                  </p>
                </div>
                <div className="flex justify-around mt-2 gap-2">
                  <Button
                    name={"Approve"}
                    classname="!w-[80px] text-[6px]"
                    titleClass=""
                    buttonClick={() => handleTimeOffStatusClick(item, true)}
                  />
                  <Button
                    name="Reject"
                    classname="!w-[80px] text-[6px]"
                    titleClass=""
                    buttonClick={() => {
                      handleTimeOffStatusClick(item, false);
                    }}
                  />
                </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewTimeOffCard;
