import { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
    from: "user" | "bot";
    text: string | ReactNode;
}

export default function ChatMessage({ from, text }: ChatMessageProps) {
    const isUser = from === "user";
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[600px] px-4 rounded-lg ${isUser
                        ? "bg-primary text-white rounded-br-none"
                        : "bg-white text-black rounded-bl-none border border-lightgray"
                    }`}
            >
                {from === "bot" && typeof text === "string" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        table: ({ node, ...props }) => (
                            <table className="w-full border-collapse border border-gray-300" {...props} />
                        ),
                        thead: ({ node, ...props }) => (
                            <thead className="bg-gray-100" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                            <th className="border border-gray-300 px-2 py-1 text-left" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                            <td className="border border-gray-300 px-2 py-1" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                            <p className="mb-2 text-sm leading-relaxed" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-6 mb-2" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-6 mb-2" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                            <li className="mb-1" {...props} />
                        ),
                    }}>
                        {text}
                    </ReactMarkdown>
                ) : (
                    text
                )}
            </div>
        </div>
    );
}
