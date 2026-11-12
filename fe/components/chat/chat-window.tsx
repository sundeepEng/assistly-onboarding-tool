// Updated ChatWindow.tsx with stability improvements

"use client";

import { useEffect, useRef, useState } from "react";
import useChat from "../../services/chat-with-openai";
import ChatMessage from "./chat-message";
import { v4 as uuidv4 } from "uuid";
import omit from "lodash/omit";
import { useDispatch } from "react-redux";
import {
  CHAT_BOT_TRAINING_VIDEOS,
  CHAT_DEFAULT_PROMPTS,
  MIN_MESSAGES_BEFORE_SUMMARIZING,
  USER_PATH_OMIT_FIELDS,
  UserPath,
} from "../../utils/constants";
import useUpdate from "../../services/update";
import useGetById from "../../services/getById";
import { useAppSelector } from "../../redux/hooks";
import { summarizeAndUpdateUser } from "../../utils/summarizeAndUpdateUser";
import { getUserIdFromToken } from "../../utils/auth";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import Loader from "../../commonComponents/loader";

interface Props {
  onClose: () => void;
  onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export default function ChatWindow({ onClose, onDragStart }: Props) {
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);
  const [chatSummary, setChatSummary] = useState<string>("");
  const [unsummarizedMessages, setUnsummarizedMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const unsummarizedMessagesRef = useRef(unsummarizedMessages);

  const loggedInUserId = getUserIdFromToken();
  const section = useAppSelector(
    (state: { dashboardTab: { activeTab: string } }) =>
      state.dashboardTab.activeTab,
  );

  const currentVideos =
    CHAT_BOT_TRAINING_VIDEOS[
    section as keyof typeof CHAT_BOT_TRAINING_VIDEOS
    ] || [];

  const { data: userData, isLoading } = useGetById({
    key: "user",
    payload: { id: loggedInUserId, path: UserPath, enabled: !!loggedInUserId },
  });

  const { mutate, isPending } = useChat();
  const updateMutation = useUpdate();

  // Initialize chat messages and summary from user data
  useEffect(() => {
    if (!userData || !section) return;
    const history = userData?.chatbot?.[section]?.chatHistory || [];
    const initialMessages = history.map((msg: any) => ({
      from: msg.createdBy === "User" ? "user" : "bot",
      text: msg.message,
    }));
    setMessages(initialMessages);
    setChatSummary(userData?.chatbot?.[section]?.chatSummary || "");
  }, [userData, section]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update unsummarized messages when messages change
  useEffect(() => {
    unsummarizedMessagesRef.current = [...unsummarizedMessages];
  }, [unsummarizedMessages]);

  // Update chat summary reference to avoid stale closure issues
  const chatSummaryRef = useRef(chatSummary);
  useEffect(() => {
    chatSummaryRef.current = chatSummary;
  }, [chatSummary]);

  // Cleanup function to summarize unsummarized messages on unmount
  useEffect(() => {
    return () => {
      const currentSummary = chatSummaryRef.current;
      if (unsummarizedMessagesRef.current.length > 0) {
        summarizeAndUpdateUser({
          messagesToSummarize: [
            ...(currentSummary
              ? [{ role: "system", content: `Summary: ${currentSummary}` }]
              : []),
            ...unsummarizedMessagesRef.current.map((msg) => ({
              role: msg.from === "user" ? "user" : "assistant",
              content: msg.text,
            })),
            {
              role: "user",
              content: "Please summarize the entire conversation.",
            },
          ] as { role: "user" | "assistant" | "system"; content: string }[],
          userData,
          section,
          updateMutation,
          dispatch,
        });
      }
    };
  }, []);

  const defaultPrompts =
    CHAT_DEFAULT_PROMPTS[section] || CHAT_DEFAULT_PROMPTS["default"];

  // Function to update summary if needed
  const updateSummaryIfNeeded = async (
    newMessages: typeof unsummarizedMessages,
    latestMessages: typeof messages,
  ) => {
    if (newMessages.length < MIN_MESSAGES_BEFORE_SUMMARIZING) return;

    const messagesToSummarize = [
      ...(chatSummary
        ? [{ role: "system", content: `Summary: ${chatSummary}` }]
        : []),
      ...newMessages.map((msg) => ({
        role: msg.from === "user" ? "user" : "assistant",
        content: msg.text,
      })),
      { role: "user", content: "Please summarize the entire conversation." },
    ] as { role: "user" | "assistant" | "system"; content: string }[];

    mutate(
      { messages: messagesToSummarize },
      {
        onSuccess: (newSummary) => {
          setChatSummary(newSummary);
          setUnsummarizedMessages([]);
          const now = new Date().toISOString();
          const existingHistory = latestMessages.map((msg) => ({
            messageId: uuidv4(),
            message: msg.text,
            createdBy: msg.from === "user" ? "User" : "Bot",
            createdAt: now,
          }));
          const updatedSection = {
            chatHistory: existingHistory,
            chatSummary: newSummary,
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

          updateMutation.mutate({ data: cleanedData, path: UserPath });
        },
      },
    );
  };

  // Function to send a message
  const sendMessage = async () => {
    if (!input.trim() || !userData || !section) return;

    const userMsg = { from: "user" as const, text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setUnsummarizedMessages((prev) => [...prev, userMsg]);
    setInput("");

    const chatMessages = [
      ...(chatSummary
        ? [
            {
              role: "system",
              content: `Summary of conversation so far: ${chatSummary}`,
            },
          ]
        : []),
      ...unsummarizedMessages.map((msg) => ({
        role: msg.from === "user" ? "user" : "assistant",
        content: msg.text,
      })),
      { role: "user", content: input },
    ] as { role: "user" | "assistant" | "system"; content: string }[];
    mutate(
      { messages: chatMessages },
      {
        onSuccess: async (botText) => {
          const botMsg = { from: "bot" as const, text: botText };
          const finalMessages = [...newMessages, botMsg];
          setMessages(finalMessages);
          setUnsummarizedMessages((prev) => [...prev, botMsg]);

          const now = new Date().toISOString();
          const updatedChatHistory = finalMessages.map((msg) => ({
            messageId: uuidv4(),
            message: msg.text,
            createdBy: msg.from === "user" ? "User" : "Bot",
            createdAt: now,
          }));

          const updatedSection = {
            chatHistory: updatedChatHistory,
            chatSummary,
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

          updateMutation.mutate({ data: cleanedData, path: UserPath });

          await updateSummaryIfNeeded(
            [...unsummarizedMessagesRef.current, botMsg],
            finalMessages,
          );
        },
      },
    );
  };

  return (
    <div className="w-[750px] h-[550px] bg-white rounded-xl shadow-xl flex flex-col border border-lightgray font-poppins">
      <div
        onPointerDown={onDragStart}
        className={`bg-primary text-white px-4 py-2 rounded-t-xl font-semibold flex justify-between items-center ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""
          }`}
      >
        <span>Assistly Bot</span>
      </div>

      {messages.length === 0 && !isPending && (
        <div className="p-3 flex flex-wrap gap-2 bg-lightgray/30">
          {defaultPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              className="text-primary px-3 py-1 rounded-full text-sm bg-white hover:bg-primary hover:text-white transition cursor-pointer max-w-[270px] overflow-hidden whitespace-nowrap text-ellipsis"
              onClick={() => setInput(prompt)}
              title={prompt}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 flex flex-wrap gap-2 bg-lightgray/30">
        {currentVideos.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className="text-primary px-3 py-1 rounded-full text-sm bg-white hover:bg-primary hover:text-white transition cursor-pointer max-w-[270px] overflow-hidden whitespace-nowrap text-ellipsis"
            onClick={async () => {
            const enabled = !!item.s3Key;
            if (!enabled) return;
              try {
                setVideoLoading(true);

                const signedUrl = await fetchPreSignedUrl(item.s3Key);

                setSelectedVideo(signedUrl);
              } catch (error) {
                console.error("Failed to fetch signed URL", error);
              } finally {
                setVideoLoading(false);
              }
            }}
            title={item.header}
          >
            {item.header}
          </button>
        ))}
      </div>

      {selectedVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-[90%] h-[80%] rounded-lg shadow-lg relative">
            {/* Close Button */}
            <div
              className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl z-50 cursor-pointer"
              onClick={() => {
                setSelectedVideo(null);
                setVideoLoading(false);
              }}
            >
              ✕
            </div>
            {videoLoading ? (
              <div className="flex items-center justify-center h-full">
                {" "}
                <Loader />{" "}
              </div>
            ) : (
              <video
                src={selectedVideo ?? ""}
                controls
                autoPlay
                preload="metadata"
                playsInline
                className="w-full h-full rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-lightgray/30">
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} from={msg.from} text={msg.text} />
        ))}
        {isPending && <ChatMessage from="bot" text={<ChatLoader />} />}
        <div ref={bottomRef} />
      </div>

      <div className="p-2 border-t border-lightgray bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <textarea
            rows={1}
            className="flex-1 resize-none p-2 border border-lightgray rounded-md focus:outline-none font-poppins overflow-y-auto h-20"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // Prevent newline
                sendMessage(); // Trigger send
              }
            }}
          />
          <button
            type="submit"
            className="bg-primary text-white px-3 rounded-md cursor-pointer font-poppins h-10"
            disabled={isPending}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatLoader() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.32s]" />
      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.16s]" />
      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
    </span>
  );
}
