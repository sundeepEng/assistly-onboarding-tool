import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { SetStateAction, useState } from "react";
import PopoverComponent from "../../../commonComponents/popover-component";
import Tabs from "../../../commonComponents/tabs";
import MenuIcon from "../../../public/icons/menu-icon";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  handleCloseRequestTimeOffModal,
  handleOpenEditTimeCardModal,
  handleOpenRequestTimeOffModal,
} from "../../../redux/slices/modal-slice";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import {
  SHIFT_STATUS_AVAILABLE,
  SHIFT_STATUS_TIMEOFF,
  UserPath,
} from "../../../utils/constants";
import EditTimeCardModal from "../timesheet/edit-time-card-model";
import {
  calculateScheduledTotalWages,
  calculateTotalScheduledHours,
  calculateTotalWages,
  calculateTotalWorkedHours,
  formatTime,
  formatToLocalLongDate,
  formatToLongDate,
  getHoursDifference,
} from "../utils/timeUtils";
import useGetById from "../../../services/getById";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import TimeOff from "../schedule/time-off";
import { getUserIdFromToken } from "../../../utils/auth";
import TaskStatus from "../tasks/task-status";
dayjs.extend(isoWeek);
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState("My Schedule");
  const dispatch = useAppDispatch();

  const loggedInUserID = getUserIdFromToken();

  const { data: loggedInUserData } = useGetById({
    key: "user",
    payload: {
      id: loggedInUserID,
      path: UserPath,
      enabled:!!loggedInUserID
    },
  });

  // Date boundaries
  const startOfWeek = dayjs().startOf("isoWeek"); // Monday
  const endOfWeek = dayjs().endOf("isoWeek"); // Sunday
  const startOfToday = dayjs().startOf("day");
  const endOfToday = dayjs().endOf("day");
  const weeklyFetchStart = startOfWeek.subtract(1, "day").startOf("day");

  const { data: allShifts = [], isLoading } = useGetAllShifts({
  key: "shifts",
  params: {
    user_id: loggedInUserID,
    shift_start_time: [weeklyFetchStart.toISOString(), endOfWeek.toISOString()],
    shift_status: SHIFT_STATUS_AVAILABLE,
  },
});

  const todayFetchStart = dayjs().subtract(1, "day").startOf("day");
const todayFetchEnd = dayjs().endOf("day");

const { data: todayDashboardShifts = [] } = useGetAllShifts({
  key: "shifts",
  params: {
    user_id: loggedInUserID,
    shift_start_time: [
      todayFetchStart.toISOString(),
      todayFetchEnd.toISOString(),
    ],
    shift_status: SHIFT_STATUS_AVAILABLE,
  },
});

  const { data: timeOffShifts = [] } = useGetAllShifts({
    key: "shifts",
    params: {
      user_id: loggedInUserID,
      shift_status: SHIFT_STATUS_TIMEOFF,
    },
  });

  const todayShifts = todayDashboardShifts?.shifts?.filter((shift) => {
    // Hide overlapping/conflicting shifts entirely from the dashboard
    if (shift?.isOverlap) return false;
    const shiftStart = dayjs(shift.shift_start_time).local();
    const shiftEnd = dayjs(shift.shift_end_time).local();

  const startedToday = shiftStart.isSame(startOfToday, "day");
  const endsToday = shiftEnd.isSame(startOfToday, "day");

  return startedToday || endsToday;
});

  // Filter time off shifts which are greater than or equal to today
  const upcomingTimeOffShifts = timeOffShifts?.shifts?.filter((shift) => {
    const shiftStart = dayjs(shift.shift_start_time).local();
    return shiftStart.isSameOrAfter(startOfToday);
  });

const weeklyScheduledEndDateShifts = allShifts?.shifts?.filter((shift) => {
  const shiftEnd = dayjs(shift.shift_end_time).local();

  return shiftEnd.isBetween(startOfWeek, endOfWeek, null, "[]");
});

  const getShiftStartedYesterdayLabel = (shift: any) => {
  const shiftStart = dayjs(shift.shift_start_time).local();

  const yesterday = dayjs().subtract(1, "day").startOf("day");

  const startedYesterday = shiftStart.isSame(yesterday, "day");

  if (!startedYesterday) {
    return null;
  }

  return `Started yesterday at ${formatTime(shift.shift_start_time)}`;
};

  const tabData = [
    {
      label: "My Schedule",
      content:   <MySchedules
    allShifts={todayShifts}
    getShiftStartedYesterdayLabel={getShiftStartedYesterdayLabel}
  />,
    },
    {
      label: "Tasks",
      content: <TaskStatus />,
    },
    // Open Shifts will be implemented for next sprint
    // {
    //     label: "Open Shifts",
    //     content: (
    //         <div className="p-4 text-gray-500 font-medium">
    //             No open shifts currently available.
    //         </div>
    //     ),
    // },
  ];

  const isRequestTimeOffModalOpen = useAppSelector(
    (state: { modal: { isRequestTimeOffModalOpen: boolean } }) =>
      state.modal.isRequestTimeOffModalOpen
  );

  return (
    <div className="p-4 flex font-poppins">
      <div className="w-3/4 space-y-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h1 className="text-xl font-semibold text-gray-800 text-center">
            Welcome back, {loggedInUserData?.name}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <Tabs
            tabs={tabData}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            containerClassName="!bg-white border-b border-solid border-[#C8C8CC]"
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="ml-4 w-1/4 space-y-4">
        {/* Weekly Summary */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-800 font-semibold">Your Week</p>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <div className="mt-2 space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span className="font-medium">Scheduled Hours:</span>
                <span>{calculateTotalScheduledHours(weeklyScheduledEndDateShifts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Scheduled Est. Wages:</span>
                <span>${calculateScheduledTotalWages(weeklyScheduledEndDateShifts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Actual Hours:</span>
                <span>{calculateTotalWorkedHours(weeklyScheduledEndDateShifts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Actual Est. Wages:</span>
                <span>${calculateTotalWages(allShifts?.shifts)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Time Off */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm font-semibold text-gray-800">
            Upcoming Time Off
          </p>

          <div className="mt-2 space-y-4 text-sm text-gray-700">
            {upcomingTimeOffShifts?.map((item, index) => (
              <div key={index} className="border-b mt-6">
                <div className="flex  items-center justify-between">
                  <p className="font-medium m-0 pr-4">
                    {item?.shift_start_time.split("T")[0] ===
                    item?.shift_end_time.split("T")[0]
                      ? formatToLocalLongDate(item.shift_start_time)
                      : `${formatToLocalLongDate(
                          item.shift_start_time
                        )} - ${formatToLocalLongDate(item.shift_end_time)}`}
                  </p>
                  <span
                    className={`inline-block text-xs font-semibold px-2  rounded-full ${
                      item.is_unavailability_approved === true
                        ? "bg-green-100 text-green-700"
                        : item.is_unavailability_approved === false
                        ? "bg-red-100 text-red-600"
                        : "bg-[#9ca3af22]"
                    }`}
                  >
                    {item.is_unavailability_approved === true
                      ? "Approved"
                      : item.is_unavailability_approved === false
                      ? "Rejected"
                      : "Pending"}
                  </span>
                </div>
                <p className="mt-2 m-0">{item.type}</p>
                <p className="text-[12px] text-gray-200 mt-0">
                  Requested ({formatToLocalLongDate(item?.created_at)})
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              name="Request Time Off"
              titleClass="text-[15px]"
              buttonClick={() => {
                dispatch(handleOpenRequestTimeOffModal());
              }}
            />
          </div>
        </div>
      </div>
      <CommonModal
        modalOpen={isRequestTimeOffModalOpen}
        setModalOpen={() => {
          dispatch(handleCloseRequestTimeOffModal());
        }}
        crossCTA
        title="Time Off"
      >
        <div className="px-[20px]">
        <TimeOff userId={loggedInUserID} defaultValues selectedCell />
        </div>
      </CommonModal>
      <EditTimeCardModal />
    </div>
  );
}

const MySchedules = ({ allShifts ,getShiftStartedYesterdayLabel}) => {
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenPopoverIndex((prev) => (prev === index ? null : index));
  };

  const dispatch = useAppDispatch();

  if (!allShifts?.length) {
    return (
      <div className="p-4 text-gray-500 font-medium">
        No shifts scheduled for today.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allShifts?.map((shift, index) => 
      {  const startedYesterdayLabel = getShiftStartedYesterdayLabel(shift);
        return(
        <div
          key={index}
          className="bg-gray-50 rounded-lg border border-gray-200 shadow-md p-2 px-6 flex items-center justify-between"
        >
          <div>
            <p className="text-sm text-gray-700 font-medium">
              {formatToLongDate(shift.shift_start_time)}
            </p>
            <p className="text-sm text-gray-600">
              {formatTime(shift.shift_start_time)} –{" "}
              {formatTime(shift.shift_end_time)} (
              {getHoursDifference(shift.shift_start_time, shift.shift_end_time)}{" "}
              hours)
            </p>
            {startedYesterdayLabel && (
  <p className="m-0 mt-1 text-xs text-amber-700 font-medium">
    {startedYesterdayLabel}
  </p>
)}
            <p>{shift.created_by_user_name}</p>
          </div>
          <div className="font-poppins">
            <PopoverComponent
              body={
                <div>
                  <div
                    className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                    onClick={() => {
                      // Add Clock In logic
                      dispatch(handleOpenEditTimeCardModal(shift));
                    }}
                  >
                    {shift?.clock_in_timestamp
                      ? "Edit Clock In"
                      : "Add Clock In"}
                  </div>
                  <div
                    className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
                    onClick={() => dispatch(handleOpenEditTimeCardModal(shift))}
                  >
                    {shift?.clock_out_timestamp
                      ? "Edit Clock Out"
                      : "Add Clock Out"}
                  </div>
                </div>
              }
              isOpen={openPopoverIndex === index}
              setIsOpen={() => handleToggle(index)}
            >
              <MenuIcon />
            </PopoverComponent>
          </div>
        </div>
      )}
      )}
    </div>
  );
};
