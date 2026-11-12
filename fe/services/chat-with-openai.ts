import axios from "axios";
import { useMutation } from "@tanstack/react-query";

export const sendMessageToBot = async ({
  messages,
}: {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<string> => {
    const res = await axios.post("/api/chat", { messages });
  return res.data.result;
};

const useChat = () => {
  return useMutation({
    mutationFn: sendMessageToBot,
    retry: 2,
  });
};

export default useChat;


export const generateCarePlan = async ({
  carePlanObject,
  placeholders,
}: {
  carePlanObject: any;
  placeholders: string[];
}) => {
  const res = await axios.post("/api/generate-careplan", {
    carePlanObject,
    placeholders,
  });
  return res.data.result;
};

export const useGenerateCarePlan = () => {
  return useMutation({
    mutationFn: generateCarePlan,
    retry: 1,
  });
};