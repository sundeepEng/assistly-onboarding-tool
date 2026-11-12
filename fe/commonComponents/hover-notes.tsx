// components/HoverNotesComponent.tsx
import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { ExtendedLead } from "../components/stage-popup";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import useUpdate from "../services/update";
import { USER_PATH_OMIT_FIELDS, UserPath, userRoles } from "../utils/constants";
import { omit } from "../utils/dateUtils";
import UserPopover from "./user-notes";

const HoverNotesComponent = ({
    children,
    data,
    popOverClass = "",
    path = UserPath,
    omitFields = USER_PATH_OMIT_FIELDS,
}: {
    children: React.ReactNode;
    data: any;
    popOverClass?: string;
    path?: string;
    omitFields?: string[];
}) => {
    const dispatch = useDispatch();
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [openedByClick, setOpenedByClick] = useState(false);
    const [note, setNote] = useState(data?.notes || "");
    const initialNote = useRef(data?.notes || "");

    const { mutate } = useUpdate();

    // Save notes if changed. This is called in useEffect Beacuse We need to Mutate when the user Clicks Outside Of an Popover, where we cannon use normal eventhandlers to do this
    const handleSave = () => {
        if (note.trim() === initialNote.current.trim()) return;
        const isNurseRole = data?.role === userRoles.NURSE;

        const normalizedAssociatedUserIds =
            isNurseRole && Array.isArray(data?.associatedUserIds)
                ? data.associatedUserIds
                      .map((item: any) => item?.userId)
                      .filter((id: any) => id)
                : undefined;
                
        const updatedData = {
            ...data,
            notes: note,
            ...(isNurseRole
                ? { associatedUserIds: normalizedAssociatedUserIds }
                : {}),
        };

        const cleanedData = { ...updatedData };

        const finalData = omit(cleanedData, omitFields) as unknown as ExtendedLead;

        const payload = { data: finalData, path };

        mutate(payload, {
            onSuccess: () => {
                dispatch(handleOpenPopover());
                dispatch(
                    handleShowPopoverMessage("Notes updated successfully")
                );
                initialNote.current = note; // sync
            },
            onError: (error: any) => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                    handleShowPopoverMessage(
                        error?.response?.data?.message ||
                            "Error in updating notes"
                    )
                );
            },
        });
    };

    // Outside click: handle close & save
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                if (isPopoverOpen) {
                    handleSave();
                    setIsPopoverOpen(false);
                    setOpenedByClick(false);
                }
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isPopoverOpen, note]);

    return (
        <div
            ref={containerRef}
            onClick={(e) => {
                e.stopPropagation();
                setIsPopoverOpen(true);
                setOpenedByClick(true);
            }}
            onMouseEnter={() => {
                if (!openedByClick) {
                    setIsPopoverOpen(true);
                }
            }}
            onMouseLeave={() => {
                if (!openedByClick) {
                    setIsPopoverOpen(false);
                }
            }}
        >
            {children}

            {isPopoverOpen && (
                <div className={`absolute left-18 z-10 ${popOverClass}`}>
                    <UserPopover note={note} onChange={setNote} />
                </div>
            )}
        </div>
    );
};

export default HoverNotesComponent;
