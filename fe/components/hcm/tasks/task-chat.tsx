import React, { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import Avatar from "../../../commonComponents/avatar";
import PopoverComponent from "../../../commonComponents/popover-component";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import Button from "../../../commonComponents/button";

interface TaskChatProps {
    messages: {
        user_id: string;
        comment: string;
        created_at?: string;
        username?: string;
        userprofileimage?: string;
    }[];
    currentUserId?: string | null;
    onSend: (text: string) => void;
}

const TaskChat = ({ messages, currentUserId, onSend }: TaskChatProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [isOpen, messages]);

    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
        setDraft("");
    };

    return (
        <PopoverComponent
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            body={
                <div className="w-[320px] flex flex-col max-h-[400px]">
                    <div className="text-sm font-semibold mb-2 pb-2 border-b border-gray-200">
                        Chat
                    </div>
                    <div className="flex-1 overflow-y-auto mb-2 pr-1 space-y-2 max-h-[280px]">
                        {messages.length > 0 ? (
                            messages.map((msg, index) => {
                                const isMe = msg.user_id === currentUserId;
                                const time = msg.created_at
                                    ? format(parseISO(msg.created_at), "h:mm a")
                                    : "";
                                return (
                                    <div
                                        key={index}
                                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                                    >
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <Avatar
                                                src={msg.userprofileimage}
                                                name={msg.username}
                                                size={24}
                                                alt={msg.username || "User"}
                                            />
                                            {msg.username && (
                                                <span className="text-[12px] !font-medium">
                                                    {msg.username}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${isMe
                                                ? "bg-primary text-white rounded-br-none border border-primary"
                                                : "bg-gray-100 text-gray-800 rounded-bl-none border border-solid border-primary"
                                                }`}
                                        >
                                            {msg.comment}
                                        </div>
                                        {time && (
                                            <span className="text-[10px] font-medium mt-1">
                                                {time}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-xs text-gray-400 text-center py-4">
                                No messages yet
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <div className="flex-1">
                            <InputFieldComponent
                                name="comment"
                                label=""
                                placeholder="Add a comment..."
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSend();
                                }}
                                containerClass="!gap-0"
                                titleClass="!h-0"
                                className="!h-9 !px-2 !py-1"
                                inputClass="!text-xs"
                            />
                        </div>
                        <Button
                            name=""
                            type="button"
                            buttonClick={handleSend}
                            icon={<Send size={16} className="rotate-45 text-white flex items-center justify-center" />}
                            classname="!w-8 !h-8 !p-0 !rounded-full !bg-primary"
                            titleClass="!hidden"
                        />
                    </div>
                </div>
            }
        >
            <div className="relative flex items-center justify-center">
                <MessageSquare
                    size={16}
                    className={`cursor-pointer ${messages.length > 0 ? "text-primary" : "text-gray-400"}`}
                />
            </div>
        </PopoverComponent>
    );
};

export default TaskChat;
