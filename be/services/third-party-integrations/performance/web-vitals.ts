import { FormatResponse } from "../../../utils/response-formatter";
import { webVitalsSchema } from "../../../models/ThirdPartyIntegrations/web-vitals.model";

export const webVitalsHandler = async (requestPayload: any) => {
  try {
    const validatedPayload = webVitalsSchema.parse(requestPayload);

    // Example payload from Next.js: { id, name, value, label, path, userAgent, ... }
    const { name, value, path, id } = validatedPayload;

    // Determine unit
    const unit = name === "CLS" ? "None" : "Milliseconds"; // CLS is unit less, others mostly ms

    const metric = {
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "Assistly/WebVitals",
            Dimensions: [["PagePath", "MetricName"]],
            Metrics: [{ Name: "Value", Unit: unit }],
          },
        ],
      },
      PagePath: path || "unknown",
      MetricName: name || "UnknownMetric",
      Value: value,
      MetricId: id,
    };

    console.log(JSON.stringify(metric)); // EMF log event

    return FormatResponse(204, {
      message: "Web vital processed successfully",
    });
  } catch (err) {
    console.error("Error processing web vital:", err);

    return FormatResponse(500, {
      message: "Error processing web vital",
    });
  }
};
