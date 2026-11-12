import { useEffect, useState } from "react";
import CommonModal from "../commonComponents/common-modal";
import Button from "../commonComponents/button";
import Form from "../commonComponents/form";
import FormInputFieldComponent from "../commonComponents/form-input-field-component";
import { MessageSquare, RotateCcw } from "lucide-react";
import { ScheduleHomeTourSchema } from "../model/crm/user.model";
import { getUserIdFromToken } from "../utils/auth";
import useCreate from "../services/create";
import { HomeTourSchedulePath, milestones, USER_PATH_OMIT_FIELDS, UserPath } from "../utils/constants";
import { useDispatch } from "react-redux";
import { handleOpenPopover, handleShowCloseOptions, handleShowPopoverMessage } from "../redux/slices/exception-popover-slice";
import { omit, set } from "lodash";
import useUpdate from "../services/update";
import { format } from "date-fns";
import TourIcon from "../public/icons/tour-icon";

export const HomeTour = ({data, currentStage, color}) => {
  const [isHomeTourModalOpen, setIsHomeTourModalOpen] = useState(false);
  return (
    <div>
      <div onClick={() => setIsHomeTourModalOpen(true)}>
      <TourIcon color={color} />{" "}
    </div>
      <HomeTourSchedule
        isHomeTourModalOpen={isHomeTourModalOpen}
        setIsHomeTourModalOpen={setIsHomeTourModalOpen}
        data={data}
      />
    </div>
  );
}

export const HomeTourSchedule = ({isHomeTourModalOpen, setIsHomeTourModalOpen, data }) => {

  const [step, setStep] = useState(1); 
  const [isHomeTourCompleted, setIsHomeTourCompleted] = useState(data?.isTourCompleted || false);
  const [comments, setComments] = useState(data?.tourNotes || "");
 const [isLoading, setIsLoading] = useState(false);
  const { mutate: createMutate } = useCreate();
  const { mutate } = useUpdate();

  useEffect(() => {
  if (isHomeTourModalOpen) {
    setStep(data?.tourDateTime ? 2 : 1);
    setIsHomeTourCompleted(data?.isTourCompleted || false);
    setComments(data?.tourNotes || "");
  }
}, [isHomeTourModalOpen, data?.tourDateTime]);

  const LoggedInUserId = getUserIdFromToken();
  const dispatch = useDispatch();



  const handleScheduleHomeTour = (formData) => {
    if (!data?.email) {
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Recipient email does not exist"));
      dispatch(handleShowCloseOptions());
      // setIsHomeTourModalOpen(false); if no email, do not close modal - if needed, we can just change this behavior
      return;
    }
    const { scheduleDate, scheduleTime } = formData;
    const chosenSlot = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (isNaN(chosenSlot.getTime()) || chosenSlot <= new Date()) {
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Please select a future date and time."));
      dispatch(handleShowCloseOptions());
      return;
    }
    setIsLoading(true);
    const tourDateTime = chosenSlot.toISOString();
    const scheduleData = {
      tourDateTime,
      pchoUserId: LoggedInUserId,
      leadUserId: data?.userId,
    };

    const scheduleHomeTourPayload = {
       userData: scheduleData,
       path: HomeTourSchedulePath
    };

    createMutate(scheduleHomeTourPayload, {
      onSuccess: (response) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Mail Sent!"));
        const updatedUser = {
        ...data,
        tourDateTime,
      };
      const cleanedStageData = omit(updatedUser, USER_PATH_OMIT_FIELDS);
      const updatePayload = {
        data: cleanedStageData,
        path: UserPath,
      };
      mutate(updatePayload);
      setIsLoading(false);
      setIsHomeTourModalOpen(false);

      },
      onError: (error) => {
        console.error("Error scheduling home tour:", error);
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Error scheduling home tour"));
        dispatch(handleShowCloseOptions());
        setIsLoading(false);
        setIsHomeTourModalOpen(false);
      },
    });
  };

  // Handle Home Tour Status Update
  const handleHomeTourStatus = () => {  
    const feedback = comments;

    // No change → close modal
  if (data?.tourNotes === feedback && isHomeTourCompleted === false) {
    setIsHomeTourModalOpen(false);
    return;
  }

  // Base updated fields
  const updatedPayload = {
    ...data,
    isTourCompleted: isHomeTourCompleted,
    tourNotes: feedback,
  };

  // If tour is completed → add milestone
  if (isHomeTourCompleted === true) {
    updatedPayload.milestone = Array.from(
      new Set([...(data?.milestone || []), milestones.TOUR])
    );
  }

  const cleanedStageData = omit(updatedPayload, USER_PATH_OMIT_FIELDS);

  const payload = {
    data: cleanedStageData,
    path: UserPath,
  };

  mutate(payload, {
    onSuccess: () => {
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Tour status updated!"));
      setStep(2);
      setIsHomeTourModalOpen(false);
    },
    onError: () => {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          isHomeTourCompleted === true
            ? "Failed to update milestone. Please try again!"
            : "Failed to save tour notes. Please try again!"
        )
      );
    },
  });
    setIsHomeTourModalOpen(false)
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex">
      <CommonModal
        modalOpen={isHomeTourModalOpen}
        setModalOpen={() => {
          setIsHomeTourModalOpen(false);
        }}
        crossCTA={true}
        className="w-[600px] overflow-y-auto"
        // paddingRight="0px"
      >
        {/* // Parent Div */}
        <div>
          {step === 1 ? (
            /* Screen 1 This is Schedule Home Tour */
            <div className="flex flex-col mt-3 px-5">
              <div className="text-lg font-semibold mb-4">
                Schedule Home Tour
              </div>
              <div className="">Schedule a tour for {data?.name}</div>
              <div className="space-y-4 mt-4">
                <Form onSubmit={handleScheduleHomeTour} schema={ScheduleHomeTourSchema}>
                  <FormInputFieldComponent
                    label="Select Date"
                    type="date"
                    className="cursor-pointer"
                    name="scheduleDate"
                    min={today}
                    max="9999-12-31"
                  />
                  <FormInputFieldComponent
                    label="Select Time"
                    type="time"
                    name="scheduleTime"
                  />
                  <div className="bg-[#514CEB33] p-3 rounded-md text-sm my-4">
                    An invitation will be sent to {data?.name} at {data?.email}{" "}
                    with the date and time of the tour.
                  </div>
                  <Button
                    classname="w-full"
                    name="Send Invitation"
                    type="submit"
                    isLoading={isLoading}
                  />
                </Form>
              </div>
            </div>
          ) : (
            /*Screen 2 This is ReSchedule Home Tour */
            <div className="flex flex-col px-5">
              <div className="text-lg font-semibold mb-2">Home Tour Status</div>
              <div>Update tour status and add comments for {data?.name}</div>
              <div className="space-y-4 mt-4">
              <div>
                <label className="block text-[20px] font-medium text-slate-700 mb-1">Is home tour finished?</label>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="tour-yes"
                      name="tour-finished"
                      value="true"
                      checked={isHomeTourCompleted === true}
                      onChange={(e) => setIsHomeTourCompleted(e.target.value === "true")}
                      className="w-4 h-4 text-primary border-border cursor-pointer"
                    />
                    <label htmlFor="tour-yes" className="text-sm text-slate-700 cursor-pointer">
                      Yes
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="tour-no"
                      name="tour-finished"
                      value="false"
                      checked={isHomeTourCompleted === false}
                      onChange={(e) => setIsHomeTourCompleted(e.target.value === "true")}
                      className="w-4 h-4 text-primary border-border cursor-pointer"
                    />
                    <label htmlFor="tour-no" className="text-sm cursor-pointer">
                      No
                    </label>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div>
                <label className="block text-[20px] font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Tour Comments
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add comments about the tour, lead feedback, next steps..."
                  className="w-[560px] h-28 p-2 border border-border rounded-md resize-none focus:outline-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  classname="bg-white  border border-[#D9D9D9] !border-solid rounded-lg text-black"
                  titleClass="!text-black"
                  name="Reschedule"
                  icon={<RotateCcw color="black"/>}
                  buttonClick={() => setStep(1)}
                />
                <Button
                  classname=""
                  name="Save"
                  buttonClick={() => handleHomeTourStatus()}
                />  
              </div>
            </div>
            </div>
          )}
        </div>
      </CommonModal>
    </div>
  );
}

