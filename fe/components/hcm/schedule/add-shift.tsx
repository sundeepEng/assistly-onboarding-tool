import React, { useEffect, useMemo, useRef, useState } from "react";
import Form from "../../../commonComponents/form";
import FormSelectComponent from "../../../commonComponents/form-select-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import WeekdaySelect from "./week-select";
import Button from "../../../commonComponents/button";
import omit from "lodash/omit";
import { useFormContext, useWatch } from "react-hook-form";

import useCreateShift from "../../../services/hcm-create-shift";
import useUpdateShift from "../../../services/hcm-update-shift";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { createUserShiftSchemaWithHomeType } from "../../../model/hcm/user-shifts.model";
import ColorSelectComponent from "./color-select";
import {
  getLocalTimeString,
  getUtcDateTimeString,
  scheduleTimeOptions,
} from "../utils/timeUtils";
import { handleCloseAddShiftModal } from "../../../redux/slices/modal-slice";
import { addDays, isBefore } from "date-fns";
import { isEqual } from "lodash";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import useGetAll from "../../../services/getAll";
import {
  GetUsersPath,
  HCM_SHIFT_OMIT_FIELDS,
  InHomeCare,
  userRoles,
} from "../../../utils/constants";
import { useGetHomeType } from "../../../utils/gethomeType";

/** Cleans up default values for editing */
function getCleanedFormDefaults(defaultValues: any) {
  if (!defaultValues) return {};
  let cleanedShifts = { ...defaultValues };
  if (cleanedShifts?.shift_start_time)
    cleanedShifts.shift_start_time = getLocalTimeString(
      cleanedShifts.shift_start_time,
    );
  if (cleanedShifts?.shift_end_time)
    cleanedShifts.shift_end_time = getLocalTimeString(
      cleanedShifts.shift_end_time,
    );
  if (typeof cleanedShifts?.pay_rate === "string")
    cleanedShifts.pay_rate = parseFloat(cleanedShifts.pay_rate);
  // Preserve user_id and assigned_to_user_id before omit so the Caregiver
  // and Client dropdowns retain their values when editing a shift
  const userId = cleanedShifts?.user_id;
  const assignedToUserId = cleanedShifts?.assigned_to_user_id;
  // Remove unwanted keys using lodash omit
  cleanedShifts = omit(cleanedShifts, [
    ...HCM_SHIFT_OMIT_FIELDS,
    "id",
    "user_id",
    "member",
    "index",
    "clock_in_timestamp",
    "clock_out_timestamp",
    "isOverlap",
  ]);
  // Re-apply so form defaults are available for editing
  if (userId) {
    cleanedShifts.user_id = userId;
  }
  if (assignedToUserId) {
    cleanedShifts.assigned_to_user_id = assignedToUserId;
  }
  return cleanedShifts;
}

// Watches the selected senior and updates the shift pay_rate field
// Uses senior's payRate when available, otherwise falls back to the caregiver's wage rate
// Preserves the saved shift pay_rate on initial load when editing
function ShiftRateField({
  seniors,
  selectedCell,
  isEdit,
  defaultPayRate,
}: {
  seniors: any[];
  selectedCell: { date: string; member?: any } | null;
  isEdit: boolean;
  defaultPayRate?: number;
}) {
  const { setValue } = useFormContext();
  const assignedToUserId = useWatch({ name: "assigned_to_user_id" });
  const initialAssignedRef = useRef<string | undefined>(assignedToUserId);
  const hasSetInitial = useRef(false);

  const caregiverPayRate =
    selectedCell?.member?.roaster?.[0]?.pay_rate ?? 0;

  useEffect(() => {
    const senior = seniors.find(
      (s) => (s?.id || s?._id || s?.userId) === assignedToUserId,
    );
    const seniorPayRate = senior?.payRate;
    const rate =
      assignedToUserId && seniorPayRate != null
        ? Number(seniorPayRate)
        : Number(caregiverPayRate);

    // On first load, keep the saved shift rate when editing so the UI shows accurate values
    if (!hasSetInitial.current) {
      hasSetInitial.current = true;
      if (isEdit) {
        setValue(
          "pay_rate",
          defaultPayRate != null ? Number(defaultPayRate) : rate,
          { shouldValidate: false },
        );
        return;
      }
    }

    // Only update when the selected senior is actually changed by the user
    if (assignedToUserId !== initialAssignedRef.current) {
      setValue("pay_rate", rate, { shouldValidate: false });
    }
  }, [
    assignedToUserId,
    seniors,
    caregiverPayRate,
    setValue,
    isEdit,
    defaultPayRate,
  ]);

  return null;
}

function AddShift({
  selectedCell,
  setSelectedWeekdays,
  selectedWeekdays,
  userId,
  defaultValues,
  view,
}: {
  selectedCell: { date: string; member?: any } | null;
  setSelectedWeekdays: (days: number[]) => void;
  selectedWeekdays: number[];
  defaultValues?: any;
  userId: string;
  view?: "week" | "month" | "day";
}) {
  const dispatch = useAppDispatch();
  const { mutate: createShift } = useCreateShift();
  const { mutate: updateShift } = useUpdateShift();
  const [isLoading, setIsLoading] = useState(false);

  const homeId = getHomeIdFromToken();
  const createdByUserId = getUserIdFromToken();

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;

  const { data: seniorsData } = useGetAll({
    key: userRoles.SENIOR,
    params: {
      userType: userRoles.SENIOR,
      homeId: homeId || "",
    },
    path: GetUsersPath,
  });

  const { data: pcgData } = useGetAll({
    key: userRoles.PCG,
    params: {
      userType: userRoles.PCG,
      homeId: homeId || "",
    },
    path: GetUsersPath,
  });

  // Extract seniors array from API response (handle different possible response structures)
  const seniorsList = useMemo(() => {
    return (seniorsData as any)?.users || (seniorsData as any) || [];
  }, [seniorsData]);

  const seniorOptions = useMemo(() => {
    // Filter out deleted seniors to only show active ones
    const activeSeniors = seniorsList.filter(
      (senior: any) => senior?.isDeleted !== true,
    );

    // Transform each senior into a dropdown option format
    const dropdownOptions = activeSeniors.map((senior: any) => {
      // Extract ID from various possible field names
      const seniorId = senior?.id || senior?._id || senior?.userId;

      // Build full name from various possible name field combinations
      const fullName =
        senior?.name ||
        [senior?.firstName, senior?.lastName].filter(Boolean).join(" ") ||
        [senior?.first_name, senior?.last_name].filter(Boolean).join(" ") ||
        "Senior";

      return {
        option: fullName, // Display text for dropdown
        value: seniorId, // Value for form submission
      };
    });

    // Filter out any options that don't have a valid value (ID)
    const validOptions = dropdownOptions.filter(
      (option: any) => !!option?.value,
    );

    return validOptions;
  }, [seniorsList]);

  const pcgOptions = useMemo(() => {
    // Extract PCGs array from API response
    const pcgList =
      (pcgData as any)?.users || (pcgData as any) || [];

    // Filter out deleted PCGs and those without a pay_rate in their roaster
    const activePcgs = pcgList.filter((pcg: any) => {
      if (pcg?.isDeleted === true) return false;
      const roaster = pcg?.roaster;
      if (!Array.isArray(roaster) || roaster.length === 0) return false;
      return roaster.some(
        (r: any) => r?.pay_rate != null && parseFloat(r.pay_rate) > 0,
      );
    });

    // Transform into dropdown options
    const dropdownOptions = activePcgs.map((pcg: any) => {
      const pcgId = pcg?.id || pcg?._id || pcg?.userId;

      const fullName =
        pcg?.name ||
        [pcg?.firstName, pcg?.lastName].filter(Boolean).join(" ") ||
        [pcg?.first_name, pcg?.last_name].filter(Boolean).join(" ") ||
        "Caregiver";

      return {
        option: fullName,
        value: pcgId,
      };
    });

    return dropdownOptions.filter(
      (option: any) => !!option?.value,
    );
  }, [pcgData]);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    let baseDate: Date;
    if (selectedCell?.date) {
      const [year, month, day] = selectedCell.date.split('T')[0].split('-').map(Number);
      baseDate = new Date(year, month - 1, day);
    } else {
      baseDate = new Date();
    }
    // Convert JS weekday (0=Sun) to weekDays index (0=Mon, 6=Sun)
    const jsDay = baseDate.getDay();
    const baseDayIndex = jsDay === 0 ? 6 : jsDay - 1;

    const getDateForWeekday = (weekday: number) => {
      // weekday: 0=Mon, 6=Sun (from WeekdaySelect)
      let diff = weekday - baseDayIndex;
      if (diff < 0) diff += 7;
      const target = new Date(baseDate);
      target.setDate(baseDate.getDate() + diff);
      return target;
    };

    // Use the shift pay_rate from the form; it is computed from the senior's payRate or caregiver's wage
    const pay_rate =
      data?.pay_rate != null ? Number(data.pay_rate) : 0;

    let pay_frequency = selectedCell?.member?.roaster?.length
      ? selectedCell?.member?.roaster[0]?.pay_frequency
      : "Hourly";

    const basePayload = {
      user_id: userId,
      home_id: homeId,
      created_by_user_id: createdByUserId,
      shift_status: "available",
      shift_color: data?.shift_color,
      notes: data?.notes ?? "",
      pay_rate,
      pay_frequency: pay_frequency,
      ...(isInHomeCare && data?.assigned_to_user_id
        ? { assigned_to_user_id: data.assigned_to_user_id }
        : {}),
    };

    if (defaultValues?.id) {
      // EDIT/UPDATE
      const originalDate = defaultValues?.shift_start_time
        ? new Date(defaultValues?.shift_start_time)
        : selectedCell
          ? new Date(selectedCell?.date)
          : new Date();
      const shiftStartTime = getUtcDateTimeString(
        originalDate,
        data?.shift_start_time,
      );
      let shiftEndTime = getUtcDateTimeString(
        originalDate,
        data?.shift_end_time,
      );

      // Handle overnight shift
      if (
        shiftStartTime &&
        shiftEndTime &&
        (isBefore(shiftEndTime, shiftStartTime) ||
          isEqual(shiftEndTime, shiftStartTime))
      ) {
        shiftEndTime = addDays(shiftEndTime, 1).toISOString();
      }

      const updatePayload = {
        ...basePayload,
        id: defaultValues.id,
        user_id:
          view === "month" ? userId || data.user_id : data.user_id || userId,
        shift_start_time: shiftStartTime,
        shift_end_time: shiftEndTime,
      };

      updateShift(updatePayload, {
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              !Array?.isArray(error?.response?.data?.error)
                ? error?.response?.data?.error
                : "Failed to update shift.",
            ),
          );
        },
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Shift updated successfully!"));
          dispatch(handleCloseAddShiftModal());
          setIsLoading(false);
        },
      });
    } else {
      // CREATE
      if (selectedWeekdays && selectedWeekdays.length > 0) {
        const bulkPayload: any[] = [];
        selectedWeekdays.forEach((weekday) => {
          const targetDate = getDateForWeekday(weekday);
          const shiftStartTime = getUtcDateTimeString(
            targetDate,
            data?.shift_start_time,
          );
          let shiftEndTime = getUtcDateTimeString(
            targetDate,
            data?.shift_end_time,
          );

          // Handle overnight shift
          if (
            shiftStartTime &&
            shiftEndTime &&
            (isBefore(shiftEndTime, shiftStartTime) ||
              isEqual(shiftEndTime, shiftStartTime))
          ) {
            shiftEndTime = addDays(shiftEndTime, 1).toISOString();
          }
          if (!basePayload?.user_id) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                "Please select a team member to create a shift.",
              ),
            );
            setIsLoading(false);
          } else {
            bulkPayload.push({
              ...basePayload,
              shift_start_time: shiftStartTime,
              shift_end_time: shiftEndTime,
            });
          }
        });
        if (bulkPayload.length > 0) {
          createShift(bulkPayload, {
            onSuccess: () => {
              dispatch(handleOpenPopover());
              dispatch(
                handleShowPopoverMessage("Shift(s) created successfully!"),
              );
              dispatch(handleCloseAddShiftModal());
              setIsLoading(false);
            },
            onError: (error: any) => {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  !Array?.isArray(error?.response?.data?.error)
                    ? error?.response?.data?.error
                    : "Failed to create shift.",
                ),
              );
              setIsLoading(false);
              dispatch(handleCloseAddShiftModal());
            },
          });
        }
      } else {
        const shiftStartTime = getUtcDateTimeString(
          baseDate,
          data?.shift_start_time,
        );
        let shiftEndTime = getUtcDateTimeString(baseDate, data?.shift_end_time);

        // Handle overnight shift
        if (
          shiftStartTime &&
          shiftEndTime &&
          (isBefore(shiftEndTime, shiftStartTime) ||
            isEqual(shiftEndTime, shiftStartTime))
        ) {
          shiftEndTime = addDays(shiftEndTime, 1).toISOString();
        }
        createShift(
          {
            ...basePayload,
            shift_start_time: shiftStartTime,
            shift_end_time: shiftEndTime,
          },
          {
            onSuccess: () => {
              dispatch(handleOpenPopover());
              dispatch(handleShowPopoverMessage("Shift created successfully!"));
            },
            onError: (error: any) => {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  !Array?.isArray(error?.response?.data?.error)
                    ? error?.response?.data?.error
                    : "Failed to create shift.",
                ),
              );
              dispatch(handleCloseAddShiftModal());
            },
          },
        );
      }
    }
  };

  const caregiverDefaultRate = Number(
    selectedCell?.member?.roaster?.[0]?.pay_rate ?? 0,
  );

  const isEdit = !!defaultValues?.id;

  const formDefaults = {
    ...getCleanedFormDefaults(defaultValues),
    assigned_to_user_id: defaultValues?.assigned_to_user_id,
    pay_rate:
      defaultValues?.pay_rate != null
        ? Number(defaultValues.pay_rate)
        : caregiverDefaultRate,
  };

  return (
    <Form
      onSubmit={onSubmit}
      schema={createUserShiftSchemaWithHomeType(isInHomeCare)}
      defaultValues={formDefaults}
    >
      <ShiftRateField
        seniors={seniorsList}
        selectedCell={selectedCell}
        isEdit={isEdit}
        defaultPayRate={
          defaultValues?.pay_rate != null ? Number(defaultValues.pay_rate) : undefined
        }
      />

      <div className="w-[520px]">
        <div className="flex gap-4">
          <FormSelectComponent
            label=""
            options={scheduleTimeOptions}
            name="shift_start_time"
            placeHolder="Start Time"
          />
          <div className="flex justify-center items-center font-semibold">
            _
          </div>
          <FormSelectComponent
            label=""
            options={scheduleTimeOptions}
            name="shift_end_time"
            placeHolder="End Time"
          />
        </div>


        {/* Inhomecare specific fields */}
        {isInHomeCare && (
          <div className="flex justify-between">
            <FormSelectComponent
              label={defaultValues?.id ? "Select Client" : ""}
              options={seniorOptions}
              name="assigned_to_user_id"
              placeHolder="Select Client"
              className={defaultValues?.id ? "pt-4" : "pt-4"}
            />
            <div className="pt-3">
              <FormInputFieldComponent
                label="Shift Rate"
                name="pay_rate"
                type="number"
                readOnly
                disabled
                placeholder="Rate"
                className="!w-[236px]"
              />
            </div>
          </div>

        )}

        {defaultValues?.id && view !== "month" && (
          <div className="flex gap-4 pb-3">
            <FormSelectComponent
              label={defaultValues?.id ? "Select Team member" : ""}
              options={pcgOptions}
              name="user_id"
              placeHolder="Select Team member"
              className={defaultValues?.id ? "pt-4" : ""}
            />
          </div>
        )}


        <div className="flex pt-3 flex-row justify-between">
          <div
            className={
              defaultValues?.id
                ? "opacity-40 pointer-events-none select-none"
                : ""
            }
            title={defaultValues?.id ? "Apply to is not available when editing a shift" : undefined}
          >
            <div className="font-poppins">Apply to</div>
            <WeekdaySelect
              initialSelected={[]}
              className=""
              selectedDate={selectedCell?.date ? (() => {
                // Parse as local date to avoid UTC timezone shift
                const [year, month, day] = selectedCell.date.split('T')[0].split('-').map(Number);
                return new Date(year, month - 1, day);
              })() : undefined}
              onChange={setSelectedWeekdays}
            />

          </div>


          <div className="flex gap-4 pt-1">
            <ColorSelectComponent name="shift_color" label="Select a color" />
          </div>
        </div>

        <div className="pt-3">
          <FormTextareaComponent
            label="Shift Notes"
            className="pr-[30px]"
            placeholder="Leave a note for the shift"
            name="notes"
            onChange={(e) => void 0}
          />
        </div>
      </div>

      <div className="flex justify-center gap-2 pt-2">
        <Button name={isLoading ? "Saving..." : "Save"} type="submit" />
      </div>
    </Form>
  );
}

export default AddShift;
