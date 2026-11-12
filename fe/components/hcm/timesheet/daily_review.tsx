// pages/DailyReview.tsx
import type { NextPage } from "next";
import { useState, useRef, useMemo } from "react";
import BaseTable from "../../../commonComponents/base-table";
import { processShiftTimes } from "../utils/timeUtils";
import Button from "../../../commonComponents/button";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import TimesheetCell from "./time-sheet-cell";
import { handleOpenEditTimeCardModal } from "../../../redux/slices/modal-slice";
import { useAppDispatch } from "../../../redux/hooks";
import EditTimeCardModal from "./edit-time-card-model";
import { GetUsersPath, SHIFT_STATUS_AVAILABLE, userRoles } from "../../../utils/constants";
import dayjs from "dayjs";
import Loader from "../../../commonComponents/loader";
import { getHomeIdFromToken, getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import useGetAll from "../../../services/getAll";

const DailyReview: NextPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const loggedInHomeId = getHomeIdFromToken();
  const role = getUserRoleFromToken();
  const startOfDayUTC = dayjs(selectedDate, "YYYY-MM-DD")
    .startOf("day")
    .utc()
    .toISOString();

  const endOfDayUTC = dayjs(selectedDate, "YYYY-MM-DD")
    .endOf("day")
    .utc()
    .toISOString();

  const { data: AllPCGs } = useGetAll({
    key: "userId",
    params: { homeId: loggedInHomeId || "", userType: userRoles.PCG },
    path: GetUsersPath,
  });
  const { data: HomeAdmin } = useGetAll({
    key: "userId",
    params: { homeId: loggedInHomeId || "", userType: userRoles.HOME_ADMIN },
    path: GetUsersPath,
  });
  const activeUsers = [
  ...(AllPCGs?.users || []),
  ...(HomeAdmin?.users || []),
].filter((user) => user.isDeleted !== true);

  const userIds = activeUsers.map((user) => user.userId);
  const params: { [key: string]: any } = {
    shift_start_time: [startOfDayUTC, endOfDayUTC],
    shift_status: SHIFT_STATUS_AVAILABLE,
    home_id: loggedInHomeId,
  };
  if (role == userRoles?.PCG) {
    const loggedInUserId = getUserIdFromToken();
    params.user_id = loggedInUserId;
  }else{
    params.user_id=userIds
  }
  const {
    data: allShifts = [],
    isLoading,
    isError,
  } = useGetAllShifts({
    key: "shifts",
    params,
  });

  const columns = [
    {
      header: "Team member",
      field: "user_id",
      minWidth: "700px",
      render: (_value, row) => <TimesheetCell data={row} />,
    },
    {
      header: "Worked",
      field: "worked",
      minWidth: "600px",
      render: (_value, row) => <WorkedTimeCell shift={row} />,
    },
    //This all columns are commented out because they are not needed in this sprint
    // {
    //   header: "Total paid breaks",
    //   field: "paidBreaks",
    //   render: (value) => <div className="text-sm text-[#2E2C34]">{value}</div>,
    // },
    // {
    //   header: "Total unpaid breaks",
    //   field: "unpaidBreaks",
    //   render: (value) => <div className="text-sm text-[#2E2C34]">{value}</div>,
    // },
    // {
    //   header: "Issues",
    //   field: "issues",
    //   render: () => <div className="text-sm text-[#BABABA] text-center">—</div>,
    // },
    // {
    //   header: "Actions",
    //   field: "actions",
    //   render: () => (
    //     <button className="w-[60px] h-[30px] text-sm font-medium text-[#7A52E3] hover:underline rounded-lg">
    //       Edit
    //     </button>
    //   ),
    // },
  ];
  return (
    <div className="px-6">
      <div className="flex items-center gap-4 mb-4">
        <div
          className="relative border-[1px] border-solid border-primary rounded-lg font-poppins"
          onClick={() =>
            (
              dateInputRef.current as HTMLInputElement & {
                showPicker?: () => void;
              }
            )?.showPicker?.()
          }
        >
          <input
            type="date"
            ref={dateInputRef}
            value={dayjs(selectedDate).format("YYYY-MM-DD")}
            max={today}
            onChange={(e) =>
              setSelectedDate(dayjs(e.target.value, "YYYY-MM-DD").toDate())
            }
            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
          />
          <div className="flex items-center border border-[#DADADA] bg-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer relative z-0 w-full h-full text-primary">
            {dayjs(selectedDate).format("dddd, MMM D, YYYY")}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loader fullScreen={false} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-[#E4E4E7]">
          <BaseTable
            columns={columns}
            data={allShifts?.shifts}
            headerStyles="bg-white text-[#5A5A5F] text-sm font-semibold border-b-[2px] border-[#E4E4E7] border-solid"
            rowStyles={() => "border-none !border-b-[2px] !border-[#E4E4E7] !border-solid "}
            cellStyles={() => " text-sm text-[#2E2C34] align-middle"}
          />
        </div>
      )}

      {/* For this Sprint We are not implementing this Add Time Card feature */}
      {/* <div className="px-6 mt-4">
        <Button
          name="+ Add time card"
          classname="font-poppins text-white rounded align-center mr-1"
          buttonClick={() => setIsOpen(true)}
          titleClass="font-normal !text-[16px] justify-center"
        />
      </div> */}

      {/* <CommonModal
        modalOpen={isOpen}
        setModalOpen={() => setIsOpen(false)}
        crossCTA={true}
        className=""
        title="Add Time Card"
      >
        <AddTimeCard setIsOpen={setIsOpen} />
      </CommonModal> */}
      <EditTimeCardModal />
    </div>
  );
};

export default DailyReview;

const WorkedTimeCell = ({ shift }: { shift: any }) => {
  const dispatch = useAppDispatch();

  // Process shift times inside the cell component
  const { workedTimeDisplay, scheduledTimeDisplay, timeDifference } =
    processShiftTimes(shift);

  return (
    <div
      className="text-sm text-[#2E2C34] cursor-pointer"
      onClick={() => dispatch(handleOpenEditTimeCardModal(shift))}
      title="Edit Time Card"
    >
      <div className="font-medium">{workedTimeDisplay}</div>
      <div className="text-[#59575A] text-sm">
        Scheduled: {scheduledTimeDisplay}
      </div>
      {timeDifference && (
        <div className="text-primary text-xs font-medium mt-1 flex items-center">
          <span className="inline-block w-[6px] h-[6px] bg-primary rounded-full mr-1"></span>
          {timeDifference}
        </div>
      )}
    </div>
  );
};
