// components/ReferralStatus.js
import _ from "lodash";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import Button from "../../commonComponents/button";
import DropdownIcon from "../../public/icons/dropdown-icon";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import useUpdate from "../../services/update";
import {
    CONTACTED,
    REFERRAL_STATUS_OPTIONS,
    USER_PATH_OMIT_FIELDS,
    UserPath,
} from "../../utils/constants";
import { getDaysAgo, omit } from "../../utils/dateUtils";
import { ExtendedLead } from "../stage-popup";

export default function ReferralStatus({ initialStatus, user }) {
    const [comment, setComment] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState(initialStatus);
    const [selectedStatus, setSelectedStatus] = useState(initialStatus); // ✅ UPDATED
    const dispatch = useDispatch();
    const latestStatus = useRef(initialStatus);

    const { mutate } = useUpdate();

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setComment(e?.target?.value);
    };

    const handleSave = async () => {
        latestStatus.current = selectedStatus;

        const dataToPost = {
            referralFollowupStatus: selectedStatus,
            referralContactedOn: new Date().toISOString(),
        };

        const formattedData = _.assign(
            {},
            user,
            _.pickBy(dataToPost, _.identity)
        );

        const cleanedData = omit(formattedData, USER_PATH_OMIT_FIELDS) as unknown as ExtendedLead;

        const payload = { data: cleanedData, path: UserPath };

        mutate(payload, {
            onSuccess: () => {
                setStatus(selectedStatus);
                setIsDropdownOpen(false);
            },
            onError: (error: any) => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                    handleShowPopoverMessage(error?.response?.data?.message)
                );
            },
        });
    };

    useEffect(() => {
        latestStatus.current = status;
    }, [status]);

    // Keep local state in sync when the API data changes after initial render
    useEffect(() => {
        setStatus(initialStatus);
        setSelectedStatus(initialStatus);
    }, [initialStatus]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                parentRef.current &&
                !parentRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Derive the displayed status directly from API data so it never goes stale
    const displayStatus = useMemo(() => {
        if (initialStatus === CONTACTED && user?.referralContactedOn) {
            return `Contacted ${getDaysAgo(user.referralContactedOn)}`;
        }
        return initialStatus;
    }, [initialStatus, user?.referralContactedOn]);

    return (
        <div className="w-full flex flex-col gap-4 border border-gray-300 rounded-md">
            <div className="w-full" ref={parentRef}>
                <div
                    className="w-full h-10 bg-blue-100 text-blue-600 font-medium text-lg px-4 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-1"
                    onClick={() => {
                        setSelectedStatus(status);
                        setIsDropdownOpen(!isDropdownOpen);
                    }}
                >
                    <span className="">{displayStatus}</span>{" "}
                    <DropdownIcon
                        isDropdownOpen={isDropdownOpen}
                        color={"currentColor"}
                    />
                </div>
                {isDropdownOpen && (
                    <div
                        ref={dropdownRef}
                        className="absolute p-2 z-10 mt-1 w-[300px] rounded-md shadow-lg bg-white border border-gray-300 flex flex-col gap-1"
                    >
                        {REFERRAL_STATUS_OPTIONS.map((option) => (
                            <div
                                key={option}
                                onClick={() => setSelectedStatus(option)} // ✅ UPDATED
                                className={`p-2 hover:bg-[lightgray] hover:cursor-pointer text-lg w-[280px] rounded-lg ${
                                    selectedStatus === option
                                        ? "bg-blue-100 text-blue-600"
                                        : ""
                                }`}
                            >
                                {option}
                            </div>
                        ))}
                        <div className="p-2 border-t border-gray-200 w-full">
                            <div className="flex justify-center align-center pt-2">
                                <Button name="Save" buttonClick={handleSave} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
