// pages/PayPeriodReview.tsx
import React, { useState, useEffect, useMemo } from "react";
import AccordainComponent from "../../../commonComponents/accordian-component";
import BaseTable from "../../../commonComponents/base-table";
import Avatar from "../../../commonComponents/avatar";
import Calendar from "./date-picker";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import _ from "lodash";
import {
  SHIFT_STATUS_AVAILABLE,
  shiftsPath,
  UserPath,
  userRoles,
  homePath,
} from "../../../utils/constants";
import {
  calculateTotalWages,
  calculateTotalWorkedHours,
  formatToLocalLongDate,
  getHoursDifference,
  getNumberOfTimeCards,
} from "../utils/timeUtils";
import dayjs from "dayjs";
import useGetById, { fetchById } from "../../../services/getById";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import { useAppDispatch } from "../../../redux/hooks";
import { handleOpenEditTimeCardModal } from "../../../redux/slices/modal-slice";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import EditTimeCardModal from "./edit-time-card-model";
import { exportPayPeriodPdf } from "../../../utils/export/exportPayPeriodPdf";
import { buildPayPeriodReport } from "../../../utils/export/pdf/buildPayPeriodReport";
import { exportPayPeriodXlsx } from "../../../utils/export/xlsx/exportPayPeriodXlsx";
import Button from "../../../commonComponents/button";
import { DownloadIcon } from "lucide-react";

// Replace this with actual employee + time data

const PayPeriodReview = () => {
  // Get current week's range (today and 6 days back)
  const getWeekRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 13);
    weekStart.setHours(0, 0, 0, 0);

    return { start: weekStart, end: now };
  };

  const [selectedRange, setSelectedRange] = useState(getWeekRange());
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [usersById, setUsersById] = useState<Record<string, any>>({});

  const selectedStartDateInUTC = selectedRange?.start
    ? dayjs(selectedRange.start, "YYYY-MM-DD")
      .startOf("day")
      .utc()
      .toISOString()
    : null;

  const selectedEndDateInUTC = selectedRange?.end
    ? dayjs(selectedRange.end, "YYYY-MM-DD").endOf("day").utc().toISOString()
    : null;

  const loggedInHomeId = getHomeIdFromToken();
  const role = getUserRoleFromToken();

  const { data: homeData } = useGetById({
    key: "home",
    payload: {
      path: homePath,
      id: loggedInHomeId,
      enabled: !!loggedInHomeId,
    },
  });
  const homeName = homeData?.home?.homeName || homeData?.home?.name || "";

  const params: { [key: string]: any } = {
    shift_status: SHIFT_STATUS_AVAILABLE,
    home_id: loggedInHomeId,
  };

  // Only add shift_start_time if selectedStartDateInUTC is not null
  if (selectedStartDateInUTC && selectedEndDateInUTC) {
    params.shift_start_time = [selectedStartDateInUTC, selectedEndDateInUTC];
  } else if (selectedStartDateInUTC) {
    params.shift_start_time = [selectedStartDateInUTC];
  } else if (selectedEndDateInUTC) {
    params.shift_start_time = [selectedEndDateInUTC]; // Adjust this if needed
  }

  if (role == userRoles?.PCG) {
    const loggedInUserId = getUserIdFromToken();
    params.user_id = loggedInUserId;
  }

  const {
    data: allShifts = [],
    isLoading,
    isError,
  } = useGetAllShifts({
    key: "shifts",
    params,
    path: shiftsPath,
  });

  const groupedShiftsByUser = useMemo(() => {
    return _.groupBy(allShifts?.shifts, "user_id");
  }, [allShifts?.shifts]);

  const userIds = Object.keys(groupedShiftsByUser);

  const usersReady =
    userIds.length === 0 ||
    userIds.every((userId) => !!usersById[userId]);

  useEffect(() => {
    const fetchUsers = async () => {
      const userIds = Object.keys(groupedShiftsByUser);

      if (!userIds.length) {
        setUsersById({});
        return;
      }

      try {
        const users = await Promise.all(
          userIds.map(async (userId) => {
            const user = await fetchById({
              id: userId,
              path: UserPath,
            });

            return {
              userId,
              user,
            };
          }),
        );

        const usersMap = users.reduce<Record<string, any>>(
          (acc, { userId, user }) => {
            acc[userId] = user;
            return acc;
          },
          {},
        );

        setUsersById(usersMap);
      } catch (error) {
        console.error("Failed to fetch users for pay period report:", error);
        setUsersById({});
      }
    };

    fetchUsers();
  }, [groupedShiftsByUser]);



  useEffect(() => {
    const userIds = Object.keys(groupedShiftsByUser);
    if (userIds.length > 0) {
      setOpenSections((prev) => {
        const newState = { ...prev };
        userIds.forEach((userId) => {
          // Initialize new sections as false (closed) if not already set
          if (!(userId in newState)) {
            newState[userId] = false;
          }
        });
        return newState;
      });
    }
  }, [groupedShiftsByUser]);



  const toggleSection = (userId: string) => {
    setOpenSections((prev) => {
      const newState = { ...prev };

      // If the clicked section is already open, toggle it to close
      if (newState[userId]) {
        newState[userId] = false;
      } else {
        // If the cli cked section is closed, open it and close all other sections
        Object.keys(newState).forEach((key) => {
          newState[key] = false; // Close all sections
        });
        newState[userId] = true; // Open the clicked section
      }

      return newState;
    });
  };

  const handleExport = async () => {
    if (isLoading || !usersReady) {
      return;
    }

    const report = buildPayPeriodReport({
      homeName,
      startDate: dayjs(selectedRange.start).format("YYYY-MM-DD"),
      endDate: dayjs(selectedRange.end).format("YYYY-MM-DD"),
      groupedShiftsByUser,
      usersById,
    });

    await exportPayPeriodXlsx(report);
  };

  // const handleValueChange = (newValue: any) => {
  //   setValue(newValue);
  // };

  return (
    <div className="w-full px-4">
      <div className="w-full pb-4 flex justify-between items-center">
        <div className="max-w-xs">
          <Calendar
            value={selectedRange}
            onChange={setSelectedRange}
          />
        </div>
        <Button
          name="Export Excel"
          type="button"
          buttonClick={handleExport}
          icon={<DownloadIcon size={18} />}
          disabled={isLoading || !usersReady}
          classname="!bg-black !text-white hover:!bg-[#1F1F1F] disabled:!opacity-50 disabled:!cursor-not-allowed !rounded-[10px] !h-[44px] !min-w-[150px] !px-[14px]"
          titleClass="!text-[0.95rem] !font-semibold !tracking-[0.2px]"
        />
      </div>
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading shifts...</div>
      ) : Object.keys(groupedShiftsByUser).length === 0 ? (
        <div className="py-8 text-[#9C9999] text-[25px] font-medium font-poppins text-center">
          No timecards found for this period.
        </div>
      ) : (
        Object.entries(groupedShiftsByUser).map(([userId, data]) => (
          <div key={userId} className="mb-2">
            <EmployeeTimeAccordion
              userId={userId}
              data={data}
              isOpen={openSections[userId]}
              onClick={() => toggleSection(userId)}
            />
          </div>
        ))
      )}
      <EditTimeCardModal />
    </div>
  );
};

export default PayPeriodReview;

const columns = [
  {
    header: "Date",
    field: "date",
    render: (_value, data) => (
      <span>{formatToLocalLongDate(data?.shift_start_time)}</span>
    ),
    minWidth: "150px",
  },
  // { header: "Role", field: "role", minWidth: "120px" },
  {
    header: "Shift rate",
    field: "pay_rate",
    render: (_value, data) => (
      <span>{`$${_value}/${data?.pay_frequency === "Monthly" ? "m" : "hr"
        }`}</span>
    ),
    minWidth: "120px",
  },
  {
    header: "Time card",
    field: "timeCard",
    render: (_value, data) => <TimeCardShow data={data} />,
    minWidth: "200px",
  },
  {
    header: "Scheduled hours",
    field: "scheduled",
    render: (_value, data) => (
      <span>
        {getHoursDifference(data?.shift_start_time, data?.shift_end_time)}
      </span>
    ),
    minWidth: "120px",
  },
  {
    header: "Actual vs. scheduled",
    field: "actualVsScheduled",
    render: (_value, data) => (
      <span>
        {getHoursDifference(
          data?.clock_in_timestamp,
          data?.clock_out_timestamp
        )}
      </span>
    ),
    minWidth: "250px",
  },
  {
    header: "Estimated wages",
    field: "estimatedWages",
    render: (_value, data) => (
      <span>
        {data?.pay_frequency === "Monthly" ? "NA" : estimatedWages(data)}
      </span>
    ),
    minWidth: "140px",
  },
];

type Props = {
  userId: string;
  data: any[];
  isOpen: boolean;
  onClick: () => void;
};

export const EmployeeTimeAccordion: React.FC<Props> = ({
  userId,
  data,
  isOpen,
  onClick,
}) => {
  const { data: userData } = useGetById({
    key: "user",
    payload: {
      path: UserPath,
      id: userId, // Use the userId prop
      enabled: !!userId
    },
  });

  const name = userData?.name ?? "";
  const profileImageUrl = userData?.profileImageUrl ?? "";
  const WageRate =
    (userData?.roaster?.length && userData?.roaster[0]?.pay_rate) ?? "-";
  const payFrequency =
    userData?.roaster?.[0]?.pay_frequency === "Monthly" ? "m" : "hr"; // Determine frequency

  return (
    <AccordainComponent
      className="!max-w-full "
      header={
        <div
          className={`w-full overflow-x-auto ${userData?.isDeleted ? "pointer-events-none" : ""
            }`}
        >
          <div
            className="min-w-[950px] grid text-sm font-medium font-jakarta rounded-t-md"
            style={{
              gridTemplateColumns: "repeat(5, minmax(180px, 1fr))",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={profileImageUrl} name={name} size={40} />
              <div
                className="text-sm w-[180px] truncate font-medium"
                title={name}
              >
                {name}
              </div>
            </div>

            {/* Col 2: WageRate */}
            <div className="px-4 ">
              <div className="text-[14px]">WageRate</div>
              <div>{`$${WageRate}/${payFrequency}`}</div>
            </div>

            {/* Col 3: Timecards */}
            <div className="px-4 ">
              <div className="text-[14px]">Timecards</div>
              <div>{getNumberOfTimeCards(data)}</div>
            </div>

            {/* Col 4: Total Hours */}
            <div className="px-4 ">
              <div className="text-[14px]">Total Hours</div>
              <div>{calculateTotalWorkedHours(data).toFixed(2)}</div>
            </div>

            {/* Col 5: Est. Wages */}
            <div className="px-4 ">
              <div className="text-[14px]">Est. Wages</div>
              <div>
                {userData?.roaster?.[0]?.pay_frequency === "Monthly"
                  ? "NA"
                  : `$${calculateTotalWages(data)}`}
              </div>
            </div>
          </div>
        </div>
      }
      isOpen={isOpen}
      onClick={onClick}
    >
      <div
        className={`${userData?.isDeleted ? "!opactiy-50 pointer-events-none" : ""
          }`}
      >
        <BaseTable
          columns={columns}
          data={data}
          headerStyles="bg-[#F0F0F0] text-[#5A5A5F] text-sm font-semibold px-4 rounded-lg"
          rowStyles={() => "border-none"}
          cellStyles={() => "px-6 py-4 text-sm text-[#2E2C34] align-middle"}
          tableContainerClass="min-w-[950px]"
        />
      </div>
    </AccordainComponent>
  );
};

type TimeCardData = {
  clock_in_timestamp: string | null;
  clock_out_timestamp: string | null;
};

export const TimeCardShow = ({ data }: { data: any }) => {
  const dispatch = useAppDispatch();

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
        .format(new Date(iso))
        .replace(/\s/g, "");
    } catch {
      return "—";
    }
  };

  const hasNoPunch =
    !data?.clock_in_timestamp && !data?.clock_out_timestamp;

  const role = getUserRoleFromToken() as Role;
  const canEditTimecard = hasAccess(role, "HCM_EDIT_TIMECARD", "EDIT");

  if (hasNoPunch) {
    if (!canEditTimecard) {
      return <span className="text-gray-400 text-sm">—</span>;
    }
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          dispatch(handleOpenEditTimeCardModal(data));
        }}
        className="text-primary text-sm font-medium cursor-pointer hover:underline"
      >
        + Add Clock In / Out
      </div>
    );
  }

  const inTime = formatTime(data?.clock_in_timestamp);
  const outTime = formatTime(data?.clock_out_timestamp);

  if (!canEditTimecard) {
    return <span className="text-sm">{`${inTime}–${outTime}`}</span>;
  }

  return (
    <span
      className="cursor-pointer hover:underline"
      title="Edit Time Card"
      onClick={(e) => {
        e.stopPropagation();
        dispatch(handleOpenEditTimeCardModal(data));
      }}
    >{`${inTime}–${outTime}`}</span>
  );
};

export const estimatedWages = (data) => {
  const { pay_rate, clock_in_timestamp, clock_out_timestamp } = data || {};
  if (!pay_rate || !clock_in_timestamp || !clock_out_timestamp) return "-";

  const clockIn = new Date(clock_in_timestamp);
  const clockOut = new Date(clock_out_timestamp);
  const diffInHours =
    (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60); // Convert milliseconds to hours
  const estimatedWage =
    diffInHours * parseFloat(pay_rate.replace(/[^0-9.-]+/g, ""));

  return `$${estimatedWage.toFixed(2)}`;
};
