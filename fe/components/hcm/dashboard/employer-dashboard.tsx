import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { FC, useContext, useEffect, useState } from "react";
import PopoverComponent from "../../../commonComponents/popover-component";
import Tabs from "../../../commonComponents/tabs";
import MenuIcon from "../../../public/icons/menu-icon";
import { useAppDispatch } from "../../../redux/hooks";
import { handleOpenEditTimeCardModal } from "../../../redux/slices/modal-slice";
import useGetById from "../../../services/getById";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import {
  CARE_TEAM,
  GetUsersPath,
  SHIFT_STATUS_AVAILABLE,
  SHIFT_STATUS_TIMEOFF,
  UserPath,
  userRoles,
} from "../../../utils/constants";
import EditTimeCardModal from "../timesheet/edit-time-card-model";
import Avatar from "../../../commonComponents/avatar";
import {
  calculateTotalWages,
  calculateTotalWorkedHours,
  formatTime,
  formatToLocalLongDate,
  getHoursDifference,
  processShiftTimes,
} from "../utils/timeUtils";
import ReviewTimeOffCard from "./ReviewTimeOffCard";
import useGetAll from "../../../services/getAll";
import Loader from "../../../commonComponents/loader";
import { getHomeIdFromToken } from "../../../utils/auth";
import { RoleContext } from "../../role-provider";
import { getUserRoleFromToken } from "../../../utils/auth";

dayjs.extend(isSameOrAfter);

function EmployerDashboard() {
  const loggedInUserHomeId = getHomeIdFromToken();

  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  const today = dayjs();

  const startOfToday = today.startOf("day");

  const fetchStart = today.subtract(1, "day").startOf("day");
  const fetchEnd = today.endOf("day");

  const startOfDayUTC = fetchStart.utc().toISOString();
  const endOfDayUTC = fetchEnd.utc().toISOString();

  const { data: AllPCGs } = useGetAll({
    key: "userId",
    params: { homeId: loggedInUserHomeId || "", userType: userRoles.PCG },
    path: GetUsersPath,
  });
  const { data: HomeAdmin } = useGetAll({
    key: "userId",
    params: { homeId: loggedInUserHomeId || "", userType: userRoles.HOME_ADMIN },
    path: GetUsersPath,
  });

const activeUsers = [
  ...(AllPCGs?.users || []),
  ...(HomeAdmin?.users || []),
].filter((user) => user.isDeleted !== true);

const userIds = activeUsers.map((user) => user.userId);

  const {
  data: allShifts = [],
  isLoading,
  isError,
} = useGetAllShifts({
  key: "shifts",
  params: {
    home_id: loggedInUserHomeId,
    shift_start_time: [startOfDayUTC, endOfDayUTC],
    shift_status: SHIFT_STATUS_AVAILABLE,
    user_id: userIds,
  },
});

  const { data: timeOffShifts = [] } = useGetAllShifts({
    key: "shifts",
    params: {
      home_id: loggedInUserHomeId,
      shift_status: SHIFT_STATUS_TIMEOFF,
      user_id: userIds,
    },
  });

  // Filter time off shifts which are greater than or equal to today
  const upcomingTimeOffShifts = timeOffShifts?.shifts?.filter((shift) => {
    const shiftStart = dayjs(shift.shift_start_time).local();
    return (
      shiftStart?.isSameOrAfter(startOfToday) &&
      shift.is_unavailability_approved === null
    );
  });

  const nowAndUpcomingShifts: any[] = [];
  const completedShifts: any[] = [];

  allShifts?.shifts?.forEach((shift) => {
    // Hide overlapping/conflicting shifts entirely from the dashboard
    if (shift?.isOverlap) return;
    const shiftStart = dayjs(shift.shift_start_time).local();
    const shiftEnd = dayjs(shift.shift_end_time).local();

    const clockOut = shift?.clock_out_timestamp
      ? dayjs(shift.clock_out_timestamp).local()
      : null;

    const isCompleted =
      shift?.clock_in_timestamp !== null && shift?.clock_out_timestamp !== null;

    const startedToday = shiftStart.isSame(startOfToday, "day");

    const endsToday = shiftEnd.isSame(startOfToday, "day");

    const clockedOutToday = clockOut?.isSame(startOfToday, "day");

    const isActiveOrScheduled = !isCompleted;

    // Completed shifts belong to the day they clocked out.

    if (isCompleted && clockedOutToday) {
      completedShifts.push(shift);
      return;
    }

    /**
     * Now & Upcoming:
     * - today's shifts
     * - overnight shifts from yesterday that end today - only if not completed
     */
    if (isActiveOrScheduled && (startedToday || endsToday)) {
      nowAndUpcomingShifts.push(shift);
    }
  });

  const totalWorkedHours = calculateTotalWorkedHours(completedShifts);
  const totalWages = calculateTotalWages(completedShifts);

  const [activeTab, setActiveTab] = useState("");

  const getShiftStartedYesterdayLabel = (shift: any) => {
    const shiftStart = dayjs(shift.shift_start_time).local();

    const yesterday = dayjs().subtract(1, "day").startOf("day");

    const startedYesterday = shiftStart.isSame(yesterday, "day");

    if (!startedYesterday) {
      return null;
    }

    return `Started yesterday at ${formatTime(shift.shift_start_time)}`;
  };

  useEffect(() => {
    setActiveTab(`Now & Upcoming (${nowAndUpcomingShifts.length})`);
  }, [nowAndUpcomingShifts.length]);

  const tabData = [
    {
      label: `Now & Upcoming (${nowAndUpcomingShifts.length})`,
      content: (
        <div className="space-y-4 p-4">
          {nowAndUpcomingShifts?.length === 0 && (
            <div className="text-gray-500">No ongoing or upcoming shifts</div>
          )}
          {nowAndUpcomingShifts?.map((shift, index) => (
            <NowAndUpcomingShiftCard
              key={index}
              shift={shift}
              getShiftStartedYesterdayLabel={getShiftStartedYesterdayLabel}
            />
          ))}
        </div>
      ),
    },
    {
      label: `Completed (${completedShifts?.length ?? 0})`,
      content:
        completedShifts?.length > 0 ? (
          <div className="space-y-4 p-4">
            {completedShifts?.map((shift, index) => (
              <CompletedShiftCard
                key={index}
                shift={shift}
                getShiftStartedYesterdayLabel={getShiftStartedYesterdayLabel}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 text-gray-500">No completed shifts</div>
        ),
    },
  ];

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="p-4 flex font-poppins">
      <div className="w-3/4">
        <div className="flex items-center justify-between h-auto bg-white rounded-[10px] shadow-md px-4">
          <div>
            <h1>{formatToLocalLongDate(new Date().toISOString())}</h1>
          </div>
          <div>
            <p className="m-0">Paid Hours</p>
            <p className="m-0">{totalWorkedHours}</p>
          </div>
          {role === userRoles.PCHO && (
            <div>
              <p className="m-0">Wages</p>
              <p className="m-0">${totalWages}</p>
            </div>
          )}
        </div>
        <div className="h-auto bg-white rounded-[10px] shadow-md mt-4 p-4">
          <Tabs
            tabs={tabData}
            activeTab={activeTab}
            onTabChange={(label) => setActiveTab(label)}
            containerClassName="!bg-white border-b border-solid border-[#C8C8CC]"
          />
        </div>
      </div>
      <div className="h-auto bg-white rounded-[10px] shadow-md w-2/5 ml-4 px-4">
        <h2 className="font-semibold text-gray-900 border-b ">Needs Review</h2>
        <hr></hr>
        {upcomingTimeOffShifts?.length > 0 && (
          <div className="max-w-sm mx-auto ">
            <ReviewTimeOffCard
              title={`Time Off Requests (${upcomingTimeOffShifts?.length})`}
              items={upcomingTimeOffShifts}
            />
          </div>
        )}
      </div>
      <EditTimeCardModal />
    </div>
  );
}

export default EmployerDashboard;

const NowAndUpcomingShiftCard: FC<{
  shift: any;
  getShiftStartedYesterdayLabel: any;
}> = ({ shift, getShiftStartedYesterdayLabel }) => {
  const {
    data: leadData,
    isLoading,
    error,
  } = useGetById({
    key: "userId",
    payload: { id: shift.user_id, path: UserPath, enabled: !!shift.user_id },
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dispatch = useAppDispatch();

  if (isLoading) {
    return <Loader fullScreen={false} spinner={false} />;
  }
  const { scheduledTimeDisplay } = processShiftTimes(shift);
  const startedYesterdayLabel = getShiftStartedYesterdayLabel(shift);

  return (
    <div className="relative px-4 bg-white rounded-lg shadow-md border">
      <div className="flex items-center gap-4 mt-4 justify-between py-2">
        {/* User Info */}
        <div className="flex items-center gap-3 w-3/4 font-jakarta">
          <Avatar name={shift?.user_name} size={40} />
          <div>
            <p className="font-semibold text-gray-900 leading-none">
              {shift?.user_name}
              <span className="text-sm text-primary font-medium ml-2">
                {leadData?.role === userRoles.PCG ? CARE_TEAM : leadData?.role}
              </span>
            </p>
            <div className="text-sm text-gray-600 m-0">
              <div className="flex m-0">
                {shift?.clock_in_timestamp ? (
                  <p className="m-0 text-green-700 font-poppins">
                    {formatTime(shift.clock_in_timestamp)} Clocked In{" "}
                  </p>
                ) : (
                  <p className="m-0 text-red-700">Not clocked in </p>
                )}
                {"  "}
                <p className="text-[#605F56] m-0">/ ({scheduledTimeDisplay})</p>
              </div>

              {startedYesterdayLabel && (
                <p className="m-0 mt-1 text-xs text-amber-700 font-medium">
                  {startedYesterdayLabel}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-1/4 justify-end h-auto items-center">
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
              isOpen={isMenuOpen}
              setIsOpen={setIsMenuOpen}
            >
              <MenuIcon />
            </PopoverComponent>
          </div>
        </div>
      </div>
    </div>
  );
};

const CompletedShiftCard: FC<{
  shift: any;
  getShiftStartedYesterdayLabel: any;
}> = ({ shift, getShiftStartedYesterdayLabel }) => {
  const { data: leadData } = useGetById({
    key: "userId",
    payload: { id: shift.user_id, path: UserPath, enabled: !!shift.user_id },
  });

  const { workedTimeDisplay, timeDifference } = processShiftTimes(shift);
  const startedYesterdayLabel = getShiftStartedYesterdayLabel(shift);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dispatch = useAppDispatch();
  return (
    <div className="relative px-4 py-4 bg-white rounded-lg shadow-md border font-poppins">
      <div className="flex items-center gap-4 justify-between">
        {/* User Info */}
        <div className="flex items-center gap-3 w-3/4 font-jakarta">
          <Avatar name={shift?.user_name} size={40} />
          <div>
            <p className="font-semibold text-gray-900 leading-none">
              {leadData?.name}
              <span className="text-sm text-primary font-medium ml-2">
                {leadData?.role === userRoles.PCG ? CARE_TEAM : leadData?.role}
              </span>
            </p>
            <div className="text-sm text-gray-600">
              <p className="m-0">
                {getHoursDifference(
                  shift.clock_in_timestamp,
                  shift.clock_out_timestamp,
                )}{" "}
                hrs Worked
                <span className="text-[#605F56]"> / ({workedTimeDisplay})</span>
              </p>

              {startedYesterdayLabel && (
                <p className="m-0 mt-1 text-xs font-medium">
                  {startedYesterdayLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-2/4 justify-between items-center">
          {timeDifference && (
            <div className="text-[#0077C8] text-xs font-medium mt-1 flex items-center">
              <span className="inline-block w-[6px] h-[6px] bg-[#0077C8] rounded-full mr-1"></span>
              {timeDifference}
            </div>
          )}
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
                    onClick={() => {
                      dispatch(handleOpenEditTimeCardModal(shift));
                    }}
                  >
                    {shift?.clock_out_timestamp
                      ? "Edit Clock Out"
                      : "Add Clock Out"}
                  </div>
                </div>
              }
              isOpen={isMenuOpen}
              setIsOpen={setIsMenuOpen}
            >
              <MenuIcon />
            </PopoverComponent>
          </div>
        </div>
      </div>
    </div>
  );
};
