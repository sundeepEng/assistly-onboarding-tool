import React from "react";
import Form from "../../../commonComponents/form";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import { reasonForTimeOffOptions } from "../../../utils/constants";
import Button from "../../../commonComponents/button";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import { TimeOffSchema } from "../../../model/hcm/user-shifts.model";
import useCreateShift from "../../../services/hcm-create-shift";
import useUpdateShift from "../../../services/hcm-update-shift";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { getLocalTimeString, getShiftDateTime } from "../utils/timeUtils";
import {
  handleCloseAddShiftModal,
  handleCloseRequestTimeOffModal,
} from "../../../redux/slices/modal-slice";
import ToggleSwitch from "../../../commonComponents/toggle-switch";
import { useFormContext } from "react-hook-form";
import { addDays, parseISO, format, isValid } from "date-fns";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";

function TimeOff({ userId, defaultValues, selectedCell }) {
  const startDateTimeOff =
    defaultValues?.shift_start_time &&
    isValid(parseISO(defaultValues.shift_start_time))
      ? format(parseISO(defaultValues.shift_start_time), "yyyy-MM-dd")
      : defaultValues?.shift_start_time?.split("T")[0];

  const endDateTimeOff = defaultValues?.shift_end_time?.split("T")[0];
  const startTimeLocal = getLocalTimeString(defaultValues?.shift_start_time);
  const endTimeLocal = getLocalTimeString(defaultValues?.shift_end_time);
  const structuredDefaultValues = {
    ...defaultValues,
    unavailability_reason: defaultValues?.unavailability_reason,
    notes: defaultValues?.notes ?? undefined,
    shift_date: startDateTimeOff || selectedCell?.date,
    shift_start_time: startTimeLocal || startDateTimeOff,
    shift_end_time: endTimeLocal || endDateTimeOff,
    isMultipleDays: false,
  };

  const [isMultipleDays, setIsMultipleDays] = React.useState(false);
  const homeId = getHomeIdFromToken();
  const createdByUserId = getUserIdFromToken();
  const [isLoading, setIsLoading] = React.useState(false);
  const dispatch = useAppDispatch();
  const { mutate: createShift } = useCreateShift();
  const { mutate: updateShift } = useUpdateShift();

  let payPerHour = selectedCell?.member?.roaster?.length
    ? selectedCell?.member?.roaster[0]?.pay_rate
    : 0;

  const handleSubmit = (data) => {
    if (isMultipleDays) {
      setIsLoading(true);
      const [sy, sm, sd] = data?.multi_day_start?.split("-").map(Number);
      const [ey, em, ed] = data?.multi_day_end?.split("-").map(Number);
      const startDate = new Date(sy, sm - 1, sd);
      const endDate = new Date(ey, em - 1, ed);

      let current = new Date(startDate);
      current.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      const bulkpayload: any[] = [];
      while (current <= endDate) {
        const dateStr = `${current.getFullYear()}-${String(
          current.getMonth() + 1
        ).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

        const shiftStartTime = getShiftDateTime(dateStr, "00:00:00");
        const shiftEndTime = getShiftDateTime(dateStr, "23:59:00");

        const payload = {
          user_id: userId,
          home_id: homeId,
          created_by_user_id: createdByUserId,
          shift_status: "timeoff",
          shift_start_time: shiftStartTime,
          shift_end_time: shiftEndTime,
          is_unavailability_approved: null,
          unavailability_reason: data?.unavailability_reason,
          notes: data?.notes,
          pay_rate: parseFloat(payPerHour),
        };
        bulkpayload.push(payload);
        current.setDate(current.getDate() + 1);
      }

        //Multiple time offs
      if (defaultValues?.id) {
        // If updating, still do one-by-one (or implement bulk update if supported)
        updateShift(
          {
            ...bulkpayload[0],
            id: defaultValues?.id,
            user_id: userId || defaultValues?.user_id,
          },
          {
            onSuccess: () => {
              setIsLoading(false);
              dispatch(handleOpenPopover());
              dispatch(
                handleShowPopoverMessage("Time off updated Successfully!")
              );
              dispatch(handleCloseAddShiftModal());
            },
            onError: (error: any) => {
              setIsLoading(false);
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(error?.response?.data?.message)
              );
            },
          }
        );
      } else if (!userId) {
        setIsLoading(false);
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Please select a team member to create a shift."
          )
        );
      } else {
        createShift(bulkpayload, {
          onSuccess: () => {
            setIsLoading(false);
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Time off created!"));
            dispatch(handleCloseAddShiftModal());
            dispatch(handleCloseRequestTimeOffModal());
          },
          onError: (error: any) => {
            setIsLoading(false);
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                !Array?.isArray(error?.response?.data?.error)
                  ? error?.response?.data?.error
                  : "Unable to create Time Off!"
              )
            );
          },
        });
      }
    } else {
      const shiftStartTime = getShiftDateTime(
        data?.shift_date,
        data?.shift_start_time
      );
      const shiftEndTime = getShiftDateTime(
        data?.shift_date,
        data?.shift_end_time
      );

      const payload = {
        user_id: userId,
        shift_status: "timeoff",
        shift_start_time: shiftStartTime,
        shift_end_time: shiftEndTime,
        is_unavailability_approved: null,
        unavailability_reason: data?.unavailability_reason,
        notes: data?.notes,
        pay_rate: parseFloat(payPerHour),
        home_id: homeId,
        created_by_user_id: createdByUserId,
      };

      if (defaultValues?.id) {
        updateShift(
          { ...payload, id: defaultValues?.id },
          {
            onSuccess: () => {
              dispatch(handleOpenPopover());
              dispatch(
                handleShowPopoverMessage("TimeOff updated successfully!")
              );
              dispatch(handleCloseAddShiftModal());
            },
            onError: (error: any) => {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  !Array?.isArray(error?.response?.data?.error)
                    ? error?.response?.data?.error
                    : "Failed to update Time Off."
                )
              );
            },
          }
        );
      } else if (!userId) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Please select a team member to create a shift."
          )
        );
      } else {
        createShift(payload, {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Time off created successfully!")
            );
            dispatch(handleCloseAddShiftModal());
            dispatch(handleCloseRequestTimeOffModal());
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage(error?.response?.data?.error));
          },
        });
      }
    }
  };

  return (
    <Form
      onSubmit={handleSubmit}
      schema={TimeOffSchema}
      defaultValues={structuredDefaultValues}
    >
      <TimeOffChild
        setIsMultipleDays={setIsMultipleDays}
        isMultipleDays={isMultipleDays}
        isLoading={isLoading}
        data={structuredDefaultValues}
      />
    </Form>
  );
}

export default TimeOff;
const TimeOffChild = ({
  setIsMultipleDays,
  isMultipleDays,
  isLoading,
  data,
}) => {
  const { setValue } = useFormContext();

  const startDate = data?.shift_date;
  const nextStartDate = startDate
    ? format(addDays(parseISO(startDate), 1), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  return (
    <div className="w-[520px]">
      <FormSelectComponent
        label="Reason"
        options={reasonForTimeOffOptions}
        className="font-poppins"
        name="unavailability_reason"
      />
      <div className="pt-[20px]">
        <FormTextareaComponent
          label="Note"
          className=""
          name="notes"
          placeholder="Leave a note"
          onChange={() => {}}
        />
      </div>
      <div className="right-0 flex justify-end py-3">
        <ToggleSwitch
          label="Multiple Days"
          onToggle={() => {
            setIsMultipleDays((prev: boolean) => {
              setValue("isMultipleDays", !prev);
              return !prev;
            });
          }}
        />
      </div>
      {isMultipleDays ? (
        <div className="flex gap-4">
          <FormInputFieldComponent
            label="Start Date"
            type="date"
            className="w-full"
            name="multi_day_start"
          />
          <FormInputFieldComponent
            label="End Date"
            type="date"
            className="w-full"
            name="multi_day_end"
            min={nextStartDate}
          />
        </div>
      ) : (
        <div className="flex gap-4">
          <FormInputFieldComponent
            label="Date"
            type="date"
            className="w-full"
            name="shift_date"
          />
          <FormInputFieldComponent
            label="Start Time"
            type="time"
            className="!w-[140px]"
            name="shift_start_time"
          />
          <FormInputFieldComponent
            label="End Time"
            type="time"
            className="!w-[140px]"
            name="shift_end_time"
          />
        </div>
      )}
      <div className="flex justify-center gap-2 mt-[30px]">
        <Button name={isLoading ? "Saving..." : "Save"} type="submit" />
      </div>
    </div>
  );
};
