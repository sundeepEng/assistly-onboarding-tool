import type { NextPage } from "next";
import Stage from "../stage";
import ActionCell from "./action-cell";
import DateCell from "./date-cell";
import DayCell from "./day-cell";
import LeadCell from "./lead-cell";

export type LeadGridType = {
    className?: string;
    lead?: string;
    initial?: string;
    days: number;
    date?: Date;
};

const LeadGrid: NextPage<LeadGridType> = ({
    className = "",
    lead = "",
    initial = "",
    days ,
    date=new Date(),
}) => {
    return (
        <div
            className={`w-[1161px] bg-grays-white max-w-full overflow-hidden flex flex-row items-start justify-start py-[162px] px-0 box-border tracking-[normal] leading-[normal] text-left text-base text-black font-poppins ${className}`}
        >
            <div className="flex-1 flex flex-row items-center justify-between flex-wrap content-center py-0 pl-[19px] pr-[21px] max-w-full gap-5">
                <LeadCell lead={lead} initial={initial} />
                <DateCell date={date} />
                <Stage/>
                <DayCell days={days} />
                <ActionCell />
            </div>
        </div>
    );
};

export default LeadGrid;
