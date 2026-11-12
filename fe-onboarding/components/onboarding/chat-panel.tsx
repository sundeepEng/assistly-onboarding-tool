import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useOnboarding } from "./onboarding-provider";

const ChatPanel = () => {
  const { messages, sendChat, chatBusy, navigateToStep, pendingStepId } = useOnboarding();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || chatBusy) return;
    setInput("");
    void sendChat(text);
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-black/10">
      <div className="px-5 py-4 border-b border-black/5">
        <h2 className="text-lg font-bold text-[#111827]">Gia</h2>
        <p className="text-sm text-gray-500">Ask anything about onboarding</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                ${
                  m.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
            >
              {m.role === "agent" ? (
                <><ReactMarkdown>{m.text}</ReactMarkdown>{m.screenId && <button disabled={!!pendingStepId} className="block rounded bg-blue-600 text-white px-3 py-1 mt-2" onClick={() => void navigateToStep(m.screenId!, m.acknowledge)}>Open</button>}</>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
        {chatBusy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3.5 py-2.5 text-sm text-gray-400">
              …
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-black/5">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-primary transition">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <button
            onClick={send}
            disabled={!input.trim() || chatBusy}
            aria-label="Send message"
            className="text-primary disabled:text-gray-300 transition"
          >
            <SendHorizonal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
