import { campaignDraft } from "../utils/constants";

export const useGenerateAIDraft = async (campaignData) => {
    try {
      const response = await fetch(`${campaignDraft}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignType: campaignData.campaignType,
          tone: campaignData.tone,
          eventContext: campaignData.eventContext || "",
          keyDetails: campaignData.keyDetails || "",
          callToAction: campaignData.callToAction || "",
          channel: campaignData?.channel || ""
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(
          `Failed to generate draft: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data

    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
        throw new Error(`Error in generateAIDraft:${errorMessage}`)
    }
  };