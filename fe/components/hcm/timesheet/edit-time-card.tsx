import { NextPage } from "next";
import { useFormContext } from "react-hook-form";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { EditTimeCardSchema } from "../../../model/hcm/user-shifts.model";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { handleCloseEditTimeCardModal } from "../../../redux/slices/modal-slice";
import useGetById from "../../../services/getById";
import useUpdateShift from "../../../services/hcm-update-shift";
import {
  CARE_TEAM,
  HCM_SHIFT_OMIT_FIELDS,
  UserPath,
  userRoles,
} from "../../../utils/constants";
import { getUserRoleFromToken } from "../../../utils/auth";
import { omit } from "../../../utils/dateUtils";
import { processShiftTimes } from "../utils/timeUtils";
import Loader from "../../../commonComponents/loader";
import _ from "lodash";

dayjs.extend(utc);

// Separate component to access form context for watching clock_in_time
const TimeCardFields = ({
  scheduledTimeDisplay,
}: {
  scheduledTimeDisplay: string | null;
}) => {
  const { watch } = useFormContext();
  const clockInTime = watch("clock_in_time");

  return (
    <div>
      <div className="mb-1 text-lg font-semibold">Worked</div>
      <div className="flex gap-2 items-center">
        <FormInputFieldComponent
          type="time"
          label="Clocked In"
          name="clock_in_time"
          className="h-[40px] !w-[216px] border border-solid border-black"
        />
        <span className="text-xl mt-5">-</span>
        <FormInputFieldComponent
          type="time"
          label="Clocked Out"
          name="clock_out_time"
          className="h-[40px] !w-[216px] border border-solid border-black"
          disabled={!clockInTime}
        />
      </div>
      <div className="mt-6 text-[18px] text-[#605F56]">
        {scheduledTimeDisplay
          ? `Scheduled : ${scheduledTimeDisplay}`
          : "No schedule found for selected date."}
      </div>
    </div>
  );
};

const EditTimeCard: NextPage = () => {
  const dispatch = useAppDispatch();

  const editTimeCardData = useAppSelector(
    (state: { modal: { editTimeCardData: any } }) =>
      state.modal.editTimeCardData,
  );

  const { scheduledTimeDisplay } = processShiftTimes(editTimeCardData);

  const { data: userData, isLoading } = useGetById({
    key: "user",
    payload: {
      path: UserPath,
      id: editTimeCardData?.user_id,
      enabled: !!editTimeCardData?.user_id,
    },
  });

  const shiftStartDate = dayjs(editTimeCardData?.shift_start_time).format(
    "YYYY-MM-DD",
  );
  const { mutate } = useUpdateShift();

  const handleSubmit = async (formData: any) => {
    const editorRole = getUserRoleFromToken();
    const isCareGiver =
      String(editorRole || "").toUpperCase() ===
      String(userRoles.PCG).toUpperCase();
    const now = dayjs();
    const clockInMinForCaregiver = now.subtract(10, "minute");
    const clockOutMaxForCaregiver = now.add(10, "minute");

    const scheduledStart = editTimeCardData?.shift_start_time
      ? dayjs(editTimeCardData.shift_start_time).local()
      : null;
    const scheduledEnd = editTimeCardData?.shift_end_time
      ? dayjs(editTimeCardData.shift_end_time).local()
      : null;
    const isScheduledOvernight =
      !!scheduledStart &&
      !!scheduledEnd &&
      scheduledEnd.startOf("day").isAfter(scheduledStart.startOf("day"));

    const originalClockInTime = editTimeCardData?.clock_in_timestamp
      ? dayjs(editTimeCardData.clock_in_timestamp).local().format("HH:mm")
      : "";
    const isClockInEdited =
      String(formData?.clock_in_time || "") !==
      String(originalClockInTime || "");

    const clockIn = formData.clock_in_time
      ? dayjs(`${shiftStartDate}T${formData.clock_in_time}`)
      : null;

    let clockOut = formData.clock_out_time
      ? dayjs(`${shiftStartDate}T${formData.clock_out_time}`)
      : null;

    if (isCareGiver) {
      if (clockOut && !clockIn) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Please enter clock-in time before clock-out time.",
          ),
        );
        return;
      }

      if (
        clockIn &&
        isClockInEdited &&
        clockIn.isBefore(clockInMinForCaregiver)
      ) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage("Clock-in time can’t be in the past."),
        );
        return;
      }
    }

    // Handle overnight shift ordering
    if (clockIn && clockOut) {
      if (clockOut.isSame(clockIn)) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Clock-out time must be greater than clock-in time.",
          ),
        );
        return;
      }

      if (clockOut.isBefore(clockIn)) {
        // Only PCHO (non-caregiver editors) can treat earlier clock-out as next-day (overnight)
        if (!isCareGiver && isScheduledOvernight) {
          clockOut = clockOut.add(1, "day");
        } else {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              "Clock-out time must be greater than clock-in time.",
            ),
          );
          return;
        }
      }

      if (clockOut.isBefore(clockIn) || clockOut.isSame(clockIn)) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Clock-out time must be greater than clock-in time.",
          ),
        );
        return;
      }
    }

    if (isCareGiver) {
      if (clockOut && clockOut.isAfter(clockOutMaxForCaregiver)) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage("Clock-out time can’t be in the future."),
        );
        return;
      }
    }

    const clockInUTC = clockIn ? clockIn.utc().toISOString() : null;
    const clockOutUTC = clockOut ? clockOut.utc().toISOString() : null;

    const updatedShiftData = {
      ...editTimeCardData,
      pay_rate: Number(editTimeCardData.pay_rate),
      notes: formData?.notes ?? editTimeCardData?.notes ?? "",
      clock_in_timestamp: clockInUTC,
      clock_out_timestamp: clockOutUTC,
    };

    const finalShiftData: any = omit(updatedShiftData, HCM_SHIFT_OMIT_FIELDS);

    mutate(finalShiftData, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Timecard updated successfully"));
        dispatch(handleCloseEditTimeCardModal());
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            `Error updating timecard: ${
              error?.response?.data?.message || "Something Went Wrong"
            }`,
          ),
        );
      },
    });
  };

  if (!editTimeCardData || isLoading || !userData) {
    return <Loader fullScreen={false} spinner={false} />;
  }

  const defaultValues = {
    clock_in_time: editTimeCardData.clock_in_timestamp
      ? dayjs(editTimeCardData.clock_in_timestamp).local().format("HH:mm")
      : "",
    clock_out_time: editTimeCardData.clock_out_timestamp
      ? dayjs(editTimeCardData.clock_out_timestamp).local().format("HH:mm")
      : "",
    notes: editTimeCardData?.notes ?? "",
  };

  return (
    <Form
      onSubmit={handleSubmit}
      defaultValues={defaultValues}
      schema={EditTimeCardSchema}
    >
      <div className="mx-auto px-6 flex flex-col gap-6 font-poppins">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="">
              {dayjs(editTimeCardData?.shift_start_time).format("ddd, MMM D")}
            </div>
            <div className="text-[24px] font-semibold">
              {userData?.name || "Unnamed"}
            </div>
            <div className="flex gap-1 text-sm text-gray-600">
              <div>
                {userData?.role === userRoles?.PCG
                  ? CARE_TEAM
                  : userData?.role || "N/A"}
              </div>
              <div>at {_.startCase(_.toLower(userData?.home))}</div>
            </div>
          </div>
        </div>

        <TimeCardFields scheduledTimeDisplay={scheduledTimeDisplay} />

        <div className="pt-3">
          <FormTextareaComponent
            label="Shift Notes"
            placeholder="Leave a note for the shift"
            name="notes"
            onChange={(e) => void 0}
          />
        </div>

        <div className="flex justify-center mt-1">
          <Button name="Save changes" />
        </div>
      </div>
    </Form>
  );
};

export default EditTimeCard;
