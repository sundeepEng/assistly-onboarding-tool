import Avatar from "../../../commonComponents/avatar";

interface TimesheetCellProps {
    data: {
        user_name: string;
        user_profile_image_url: string;
    };
}

const TimesheetCell = (row: TimesheetCellProps) => {
    const name = row?.data?.user_name ?? "";
    const profileImageUrl = row?.data?.user_profile_image_url ?? "";

    return (
        <div className="flex items-center gap-3 pl-[20px] font-jakarta">
            <Avatar src={profileImageUrl} name={name} size={40} />

            <div className="flex items-center h-10 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap">
                <p
                    className="text-sm w-[180px] truncate font-medium"
                    title={name}
                >
                    {name?.length > 15 ? `${name.substring(0, 15)}...` : name}
                </p>
            </div>
        </div>
    );
};

export default TimesheetCell;
