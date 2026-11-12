import { useEffect, useState } from "react";
import Toggle from "../../commonComponents/toggle";
import SelectComponent from "../../commonComponents/select-component";
import { Stepper } from "react-form-stepper";
import TextareaComponent from "../../commonComponents/textarea-component";
import Button from "../../commonComponents/button";
import React from "react";
import { Mail, MessageSquare } from "lucide-react";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import {
  AUDIENCE_LABELS,
  campaignChannelType,
  campaignOptions,
  campaignType,
  smartCrm,
  toneOptions,
  UserPath,
} from "../../utils/constants";
import { getHomeIdFromToken, getUserIdFromToken } from "../../utils/auth";
import { v4 as uuidv4 } from "uuid";
import useUpsert from "../../services/upsert";
import useGetById from "../../services/getById";
import { useGenerateAIDraft } from "../../services/campaign-generate-draft";
import Loader from "../../commonComponents/loader";
import PopoverComponent from "../../commonComponents/popover-component";
import InfoIcon from "../../public/icons/info-circle-icon";



interface CampaignModalProps {
  selectedReferrals: Array<{
    name?: string;
    email?: string;
    mobile?: string;
    hasOptedOut?: boolean;
  }>;
  setCampaignModal: React.Dispatch<React.SetStateAction<boolean>>;
  campaignAudience: any;
}

export default function CampaignModal({
  selectedReferrals,
  setCampaignModal,
  campaignAudience,
}: CampaignModalProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isDraftGenerated, setIsDraftGenerated] = useState(false);
  const [infoOpen, setinfoOpen] = useState(false);
  const dispatch = useDispatch();
  const homeId = getHomeIdFromToken();
  const userId = getUserIdFromToken();
  const modalBodyRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({
          top: modalBodyRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    });
  };

  const { data: campaignSendingUser } = useGetById({
    key: "userId",
    payload: {
      id: userId,
      path: UserPath,
      enabled: !!userId,
    },
  });
  const audienceLabel = AUDIENCE_LABELS[campaignAudience];
  const campaignTypeValue =
    campaignAudience === AUDIENCE_LABELS.senior ? campaignType.senior : campaignType.referral;
  const audienceNames = React.useMemo(() => {
    return selectedReferrals
      .map((r) => r.name?.trim())
      .filter(Boolean) as string[];
  }, [selectedReferrals]);
  const recipientStats = React.useMemo(() => {
    return {
      total: selectedReferrals.length,
      withEmail: selectedReferrals.filter((ref) => ref.email).length,
      withPhone: selectedReferrals.filter((ref) => ref.mobile).length,
      missingEmail: selectedReferrals.filter((ref) => !ref.email).length,
      missingPhone: selectedReferrals.filter((ref) => !ref.mobile).length,
    };
  }, [selectedReferrals]);
  const [formData, setFormData] = useState({
    channel: "",
    campaignType: "",
    message: "",
    tone: "",
    eventContext: "",
    keyDetails: "",
    subjectDetails: "",
    useAI: false,
    isEditing: false,
  });
  useEffect(()=>{
setError("")
  },[formData])

  const isSmsChannel = formData.channel === campaignChannelType.sms;
  const isEmailChannel = formData.channel === campaignChannelType.email;
  React.useEffect(() => {
    if (step === 2 && isDraftGenerated && formData.message) {
      const t = setTimeout(() => {
        scrollToBottom();
      }, 150);

      return () => clearTimeout(t);
    }
  }, [step, isDraftGenerated, formData.message]);
  const [validationErrors, setValidationErrors] = useState<any>({});
  const { mutate } = useUpsert();

  // Extracts a leading "Subject: ..." line from an AI-generated email draft
  // so the subject can be saved separately from the body.
  const parseEmailDraft = (draft: string): { subject: string; body: string } => {
    const lines = draft.split("\n");
    const firstLine = lines[0] || "";
    const subjectMatch = firstLine.match(/^subject[\s:]*(.+)$/i);
    if (subjectMatch) {
      const subject = subjectMatch[1].trim();
      const body = lines.slice(1).join("\n").replace(/^\n+/, "").trim();
      return { subject, body };
    }
    return { subject: "", body: draft.trim() };
  };

  const generateAIDraft = async () => {
    if (!formData.campaignType || !formData.tone) {
      setError("Please select both campaign type and tone");
      return;
    }
    setIsGeneratingDraft(true);
    setIsLoading(true);
    setError("");

    try {
      const data = await useGenerateAIDraft({
        campaignType: formData.campaignType,
        tone: formData.tone,
        eventContext: formData.eventContext,
        keyDetails: formData.keyDetails,
        channel:formData.channel
      });

      // if API returns { draft: "..." }
      if (!data?.draft) {
        throw new Error("No draft content received from the server");
      }

      let message = data.draft;
      let subject = "";

      if (formData.channel === campaignChannelType.email) {
        const parsed = parseEmailDraft(data.draft);
        message = parsed.body;
        subject = parsed.subject;
      }

      setFormData((prev) => ({
        ...prev,
        message,
        subjectDetails: subject,
        isEditing: false, // reset manual-edit flag when AI regenerates
      }));

      setIsDraftGenerated(true);
      setStep(2);
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (err) {
      console.log(err);
      setError("Failed to generate draft");
    } finally {
      setIsLoading(false);
      setIsGeneratingDraft(false);
    }
  };

  const validateStep = (step) => {
    const errors: any = {};

    if (step === 1 && !formData.channel) {
      errors.channel = "Please select a channel";
    }
    if (step === 2) {
      if (!formData.message?.trim()) {
        errors.message = "Message is required";
      } else if (
        formData.channel === campaignChannelType.sms &&
        !isDraftGenerated &&
        formData.message.length > 320
      ) {
        errors.message = "Message exceeds 320 characters";
      } else if (
        formData.channel === campaignChannelType.sms &&
        isDraftGenerated &&
        formData.message.length > 320
      ) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "AI-generated SMS message exceeds 320 characters, allowing it",
          ),
        );
        // No error, just a log
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    if (isEmailChannel && !campaignSendingUser?.email) {
      setError("Unable to determine sender email. Please try again.");
      return;
    }

    if (isSmsChannel && !campaignSendingUser?.mobile) {
      setError("Unable to determine sender mobile number. Please try again.");
      return;
    }

    setIsLoading(true);
    setError("");
    const users = selectedReferrals.map((user: any) => {
      return {
        userId: user?.userId,
        userName: user?.name,
        userEmail: user?.email,
        userMobile: user?.mobile,
      };
    });
    const formattedBody = formData.message.replace(/\n/g, "<br>");
    const payload: any = {
      data: {
        homeId,
        campaignId: uuidv4(),
        campaignChannel: formData.channel,
        campaignType: campaignTypeValue,
        campaignUsers: users,
        campaignCreatedByUserId: userId,
        campaignMetadata: {
          subject: formData.subjectDetails || formData.keyDetails,
          body: formattedBody,
        },
        createdAt: new Date().toISOString(),
      },
      path: smartCrm,
    };

      payload.data.campaignSenderEmail = campaignSendingUser.email;
    mutate(payload, {
      onSuccess: (e) => {
        setIsLoading(false);
        setCampaignModal(false);
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Campaign created Successfully!"));
      },
      onError: (err) => {
        setIsLoading(false);
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Failed to send campaign. Please try again.",
          ),
        );
        setError("Failed to send campaign. Please try again.");
        console.error("Error sending campaign:", err);
      },
    });
  };

  const nextStep = () => {
    if (isEmailChannel && recipientStats?.withEmail==0) {
      setError("No selected users have a valid email address. Please select users with email addresses to start the email campaign.");
      return;
    }

    if (isSmsChannel && recipientStats?.withPhone==0) {
      setError("No selected users have a valid phone number. Please select users with phone numbers to start the SMS campaign.");
      return;
    }
        if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const renderStep1 = () => (
    <div className="space-y-4 p-4">
      <div className="text-lg font-medium">Audience Summary</div>
      <div className="border rounded-lg bg-gray-50 p-3">
        <div className="text-sm font-medium mb-2">
          Selected {audienceLabel} ({audienceNames.length})
        </div>

        {audienceNames.length ? (
          <div className="max-h-32 overflow-y-auto text-sm">
            {audienceNames.map((name, idx) => (
              <p key={`${name}-${idx}`} className="">
                {name}
              </p>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No names available</div>
        )}
      </div>

      <div className="font-medium">Select Channel</div>
      <div className="grid grid-cols-2 gap-4">
        <div
          className="cursor-pointer"
          onClick={() =>
            handleInputChange({
              target: { name: "channel", value: campaignChannelType.email },
            })
          }
        >
          <div
            className={`flex items-start gap-3 border-2 border-solid rounded p-4 ${
              formData.channel === campaignChannelType.email
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Mail className="" />
            </div>
            <div className="flex-1 ">
              <div className="font-medium ">Email</div>
              <p className="text-sm text-muted-foreground">
                Send email with subject
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {recipientStats.withEmail} valid recipients
              </p>
            </div>
          </div>
        </div>
        {/* <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Email</h4>
                <p className="text-sm text-muted-foreground">Send email with subject and body</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recipientStats.withEmail} valid recipients
                </p>
              </div> */}
        <div className="cursor-pointer">
          <div
            className={`flex items-start gap-3 border-2 border-solid rounded p-4 ${
              formData.channel === campaignChannelType.sms
                ? "border-green-600 bg-green-50"
                : "border-gray-200"
            }`}
            onClick={() =>
              handleInputChange({
                target: { name: "channel", value: campaignChannelType.sms },
              })
            }
          >
            <div
              className={
                "flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600"
              }
            >
              <MessageSquare className="" />
            </div>
            <div className="flex-1 ">
              <div className="font-medium ">SMS</div>
              <p className="text-sm text-muted-foreground">
                Send short text message
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {recipientStats.withPhone} valid recipients
              </p>
            </div>
          </div>
        </div>
      </div>
      {validationErrors?.channel && (
        <p className="text-red-500 text-sm">{validationErrors?.channel}</p>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 p-4">
      <div className="flex justify-center mb-4">
        <Toggle
          toggelState={formData.useAI}
          setToggleState={() =>
            setFormData((prev) => ({ ...prev, useAI: !prev.useAI }))
          }
          state1="Write Myself"
          state2="Generate with AI"
        />
      </div>

      {formData.useAI ? (
        <div className="space-y-4">
          <SelectComponent
            label="Campaign Goal"
            options={campaignOptions}
            value={formData.campaignType}
            onChange={(e) =>
              handleInputChange({
                target: { name: "campaignType", value: e.target.value },
              })
            }
            name="campaignType"
          />

          <SelectComponent
            label="Tone"
            options={toneOptions}
            value={formData.tone}
            onChange={(e) =>
              handleInputChange({
                target: { name: "tone", value: e.target.value },
              })
            }
            name="tone"
          />

          <TextareaComponent
            label="Event/Context"
            value={formData.eventContext}
            onChange={(e) =>
              handleInputChange({
                target: { name: "eventContext", value: e.target.value },
              })
            }
            name="eventContext"
          />

          <TextareaComponent
            label="Key Details"
            value={formData.keyDetails}
            onChange={(e) =>
              handleInputChange({
                target: { name: "keyDetails", value: e.target.value },
              })
            }
            name="keyDetails"
          />
          {isGeneratingDraft && (
            <div className="border rounded-lg bg-gray-50 p-4">
              <Loader
                fullScreen={false}
                message="Generating AI draft..."
                size={36}
              />
            </div>
          )}

          {/* <TextareaComponent
            label="Call-to-Action (Optional)"
            value={formData.callToAction}
            onChange={(e) =>
              handleInputChange({
                target: { name: "callToAction", value: e.target.value },
              })
            }
            name="callToAction"
          /> */}

          <Button
            name="Generate Draft"
            buttonClick={() => {
              generateAIDraft();
            }}
            disabled={!formData.campaignType || !formData.tone}
          />
          {isDraftGenerated && (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50">
             <div className=" mb-2 font-bold">
               <div className="flex justify-between">
                <div> Message Preview</div>
                <div>
                  <PopoverComponent
                    body={
                      <div className="w-[300px] font-poppins">
                        {
                          "Note: Generated messages will have [placeholder(s)], please replace them before confirming message"
                        }
                      </div>
                    }
                    isOpen={infoOpen}
                    setIsOpen={setinfoOpen}
                    triggerOnHover={true}
                    zIndex={2000}
                  >
                    <div className="flex cursor-pointer w-[20px] h-[20px] rounded-lg justify-center ">
                      <InfoIcon />
                    </div>
                  </PopoverComponent>
                </div>
                </div>
                </div>

              <div className="space-y-2">
                <TextareaComponent
                  value={formData.message}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  name="message"
                  rows={Math.min(formData.message.split("\n").length + 1, 10)}
                  className="w-full p-0 border-0 bg-transparent resize-none focus:ring-0 focus:outline-none overflow-y-auto max-h-[300px]"
                  label=""
                />
                {formData.channel === campaignChannelType.sms && (
                  <div className="text-sm text-gray-500 text-right">
                    {formData.message.length}/320 characters
                  </div>
                )}
              </div>

              <p className="mt-2 text-sm text-gray-500">
                Your changes are saved automatically
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1">
          <TextareaComponent
            label="Subject"
            value={formData.subjectDetails}
            onChange={(e) =>
              handleInputChange({
                target: { name: "subjectDetails", value: e.target.value },
              })
            }
            name="subjectDetails"
            rows={1}
          />
          <div className="p-2"></div>
          <TextareaComponent
            label={`${formData.channel === campaignChannelType.sms ? "Sms" : "Email"} Message`}
            value={formData.message}
            onChange={(e) =>
              handleInputChange({
                target: { name: "message", value: e.target.value },
              })
            }
            name="message"
          />
          <div className="text-sm text-gray-500 mt-1">
            {formData.message.length}/320 characters
          </div>
          {validationErrors?.message && (
            <p className="text-red-500 text-sm mt-1">
              {validationErrors?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-medium">Message Preview</h3>
      <div className="border rounded-lg p-4 bg-gray-50">
        <pre className="whitespace-pre-wrap">
          {formData.message || "No message content"}
        </pre>
      </div>
      <div className="mt-6">
        <h4 className="font-medium mb-2">
          Recipients ({isSmsChannel ? recipientStats?.withPhone : recipientStats?.withEmail})
        </h4>
        <div className="max-h-40 overflow-y-auto border rounded">
          {isSmsChannel ? recipientStats?.withPhone : recipientStats?.withEmail} will view your message
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="flex justify-between p-4 border-t">
      <div>
        {step > 1 && (
          <Button name="Back" buttonClick={prevStep} disabled={isLoading} />
        )}
      </div>
      <div className="space-x-2">
        {step < 3 ? (
          <Button name="Next" buttonClick={nextStep} disabled={isLoading} />
        ) : (
          <Button
            name={isLoading ? "Sending..." : "Send Now"}
            buttonClick={handleSubmit}
            disabled={isLoading}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-2xl">
      <div className="px-4 border-b">
        <h2 className="text-xl font-semibold">Send Bulk Campaign</h2>
        <div className="flex justify-between">
          <Stepper
            className="w-full"
            styleConfig={{
              activeBgColor: "#514ceb",
              activeTextColor: "white",
              completedBgColor: "#514ceb90",
              completedTextColor: "white",
              inactiveBgColor: "white",
              inactiveTextColor: "black",
              size: "2rem",
              circleFontSize: "1rem",
              labelFontSize: "1rem",
              borderRadius: "50%",
              fontWeight: "bold",
            }}
            steps={[
              { label: "Channel" },
              { label: "Compose" },
              { label: "Review" },
            ]}
            activeStep={step - 1}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 mx-4 mt-4 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-3 mx-4 mt-4 rounded-md text-sm">
          Campaign sent successfully!
        </div>
      )}

      <div ref={modalBodyRef} className="overflow-y-auto max-h-[60vh]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {renderFooter()}
    </div>
  );
}
