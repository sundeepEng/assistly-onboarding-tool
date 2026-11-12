export default async function fecthChatData() {
  const videoTranscript =
    "Welcome to the Compliance Training Module for new caregivers at Assistly Senior Living. In this module, we’ll cover key guidelines on medication handling, resident rights, and emergency protocols. First, always verify the resident’s identity using two identifiers before administering medication. Document the medication pass immediately and accurately. If a resident refuses medication, do not force it. Instead, log the refusal and notify the supervising nurse. Next, understand that all residents have the right to privacy, dignity, and informed consent. Never disclose personal or medical information without proper authorization. In case of emergency—such as fire, injury, or sudden illness—follow the posted protocol. Call 911 when needed, notify the nurse-in-charge, and ensure other residents are safe. Thank you for completing this training. Your role is essential in maintaining a safe and respectful environment for our residents.";
  const documentText =
    "This training module focuses on infection control and hygiene practices for staff members. Key points: 1.Wash hands with soap and water for at least 20 seconds before and after resident contact. 2.Use gloves when handling bodily fluids and dispose of them properly. 3.Sanitize shared equipment between uses. 4.Report any signs of infection to the healthcare team immediately. Proper hygiene prevents outbreaks and keeps our senior residents safe. Always follow the facility's infection control policy and attend monthly refresher trainings.";
  const sourceText = videoTranscript || documentText;
  const res = await fetch("../api/quiz-generation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: sourceText }),
  });
  const data = await res.json();

}
