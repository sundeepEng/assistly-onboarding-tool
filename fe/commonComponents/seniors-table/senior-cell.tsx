import { useRouter } from "next/router";
import React from "react";
import { useDispatch } from "react-redux";
import HoverNotesComponent from "../hover-notes";
import Avatar from "../avatar";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import {
    CLINICAL_USER_PATH_OMIT_FIELDS,
    ClinicalUserPath,
} from "../../utils/constants";

interface SeniorCellProps {
    data: {
        userId: string;
        name: string;
        initial?: string;
        profileImageUrl?: any;
    };
}

const SeniorCell: React.FC<SeniorCellProps> = ({ data }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const navigateLead = () => {
        if (data) {
            router.push(`/clinical/biography/${data?.userId}`);
        } else {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Lead data not found"));
        }
    };
    return (
        <div className="flex items-center gap-3 pl-[20px] font-jakarta">
            <HoverNotesComponent
                data={data}
            >
                <Avatar src={data?.profileImageUrl} name={data?.name} size={40} />
            </HoverNotesComponent>
            <div
                className="flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap"
                onClick={navigateLead}
            >
                <p
                    className="m-0 truncate max-w-[150px] overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer text-s"
                    title={data?.name}
                >
                    {data?.name?.length > 15
                        ? `${data?.name.substring(0, 15)}...`
                        : data?.name}
                </p>
            </div>
        </div>
    );
};

export default SeniorCell;
