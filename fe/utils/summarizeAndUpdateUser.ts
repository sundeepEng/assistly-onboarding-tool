import { USER_PATH_OMIT_FIELDS, UserPath } from "./constants";
import { omit } from "./dateUtils";
import { v4 as uuidv4 } from "uuid";

// Function to summarize messages and update user data 
export async function summarizeAndUpdateUser({
    messagesToSummarize,
    userData,
    section,
    updateMutation,
}: {
    messagesToSummarize: { role: "user" | "assistant" | "system"; content: string }[];
    userData: any;
    section: string;
    updateMutation: any;
    dispatch: any;
}) {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messagesToSummarize }),
        });

        const data = await response.json();
        const summary = data.result;

        if (!summary || !userData) return;

        const now = new Date().toISOString();

        const combinedHistory = [
            ...(userData.chatbot?.[section]?.chatHistory || []),
            ...messagesToSummarize
                .filter(
                    (msg) =>
                        msg.role !== "system" &&
                        msg.content !== "Please summarize the entire conversation."
                )
                .map((msg) => ({
                    messageId: uuidv4(),
                    message: msg.content,
                    createdBy: msg.role === "user" ? "User" : "Bot",
                    createdAt: now,
                })),
        ];

        const updatedSection = {
            chatHistory: combinedHistory,
            chatSummary: summary,
        };

        const updatedChatbot = {
            ...userData.chatbot,
            [section]: updatedSection,
        };

        const formattedData = {
            ...userData,
            chatbot: updatedChatbot,
        };

        const cleanedData = omit(formattedData, USER_PATH_OMIT_FIELDS);

        updateMutation.mutate(
            { data: cleanedData, path: UserPath },
        );
    } catch (err) {
        console.error("Detached summary save failed:", err);
    }
}