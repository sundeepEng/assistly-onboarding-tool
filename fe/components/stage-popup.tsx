import _ from "lodash";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import Button from "../commonComponents/button";
import PopoverComponent from "../commonComponents/popover-component";
import TextareaComponent from "../commonComponents/textarea-component";
import CrossIcon from "../public/icons/cross-icon";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import useUpdate from "../services/update";
import { milestones, USER_PATH_OMIT_FIELDS, UserPath } from "../utils/constants";
import { omit } from "../utils/dateUtils";
import { Lead } from "./leads-table";

export type ExtendedLead = Lead & {
    tourNotes: string;
    tour_completed: string;
    milestone: string;
};

const StagePopup = ({
    trigger,
    stageName,
    data,
}: {
    trigger: React.ReactNode;
    stageName: string[];
    data?: Lead;
}) => {
    const [feedback, setFeedback] = useState(data?.tourNotes || "");
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { mutate } = useUpdate();
    const dispatch = useDispatch();
    const handleFormSubmit = () => {
        setLoading(true);
        if(data?.tourNotes === feedback){
            setLoading(false);
            setPopoverOpen(false);
            return;
        }
        const formattedFormData = {
            ...data,
            tourNotes: feedback,
            milestone: Array.from(
                new Set([...data?.milestone, milestones?.TOUR])
            ),
        };
        const formattedData = _.merge({}, data, formattedFormData);
        const cleanedStageData = omit(formattedData, USER_PATH_OMIT_FIELDS);
        const payload = {
            data: cleanedStageData as unknown as ExtendedLead,
            path: UserPath,
        };

        mutate(payload, {
            onSuccess: () => {
                dispatch(handleOpenPopover());
                dispatch(
                    handleShowPopoverMessage("Milestone updated successfully!")
                );
                setPopoverOpen(false);
            },
            onError: () => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                    handleShowPopoverMessage(
                        `${
                            stageName?.length > 0 &&
                            stageName?.includes(milestones.TOUR)
                                ? "Failed to save tour notes. Please try again."
                                : "Failed to update the milestone. Please try again!"
                        }`
                    )
                );
            },
        });
        setLoading(false);
    };

    const popoverBody = (
        <div>
            <div
                onClick={() => setPopoverOpen(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-black cursor-pointer"
            >
                <CrossIcon />
            </div>
            <h2 className="text-lg font-medium text-center mb-1">
                {stageName?.length > 0 && stageName?.includes(milestones.TOUR)
                    ? "Home Tour Finished !"
                    : stageName?.includes(milestones.INITIAL_CONTACT) && ""}
            </h2>
            <TextareaComponent
                label={
                    stageName?.includes(milestones.TOUR)
                        ? ""
                        : "Confirm the lead visit to finish the tour"
                }
                placeholder="Please add comments if any"
                name="feedback"
                value={data?.tourNotes}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full h-20 border border-gray-300 rounded-lg p-3 text-gray-700 focus:outline-none"
            />

            <div className="flex justify-center mt-4">
                <Button
                    name={
                        stageName?.length > 0 &&
                        stageName?.includes(milestones.TOUR)
                            ? "SAVE"
                            : stageName?.includes(milestones.INITIAL_CONTACT) &&
                              "Finish Tour"
                    }
                    isLoading={loading}
                    buttonClick={handleFormSubmit}
                />
            </div>
        </div>
    );

    return (
        <div>
            <PopoverComponent
                body={popoverBody}
                isOpen={popoverOpen}
                setIsOpen={setPopoverOpen}
            >
                <div onClick={() => setPopoverOpen(!popoverOpen)}>
                    {trigger}
                </div>
            </PopoverComponent>
        </div>
    );
};

export default StagePopup;
