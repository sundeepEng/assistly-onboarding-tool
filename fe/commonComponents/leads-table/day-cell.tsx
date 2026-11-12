export default function DayCell({ days }:{days:number}) {
    return (
        <div className="w-[174px] flex flex-row items-center justify-center py-2.5 px-0 box-border">
            <div className="relative pl-5 pr-5">
                {(days) > 9 ? days + "days " : "day"}ago
            </div>
        </div>
    );
}
