"use client";

import { Bot, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ChatWindow from "./chat-window";

export default function ChatPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ right: 80, bottom: 80 });
    const [isDragging, setIsDragging] = useState(false);

    const movedRef = useRef(false);
    const dragStartRef = useRef({
        x: 0,
        y: 0,
        right: 80,
        bottom: 80,
    });

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        movedRef.current = false;
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            right: position.right,
            bottom: position.bottom,
        };
    };

    const handleClick = () => {
        if (!movedRef.current) {
            setIsOpen((prev) => !prev);
        }
    };

    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e: PointerEvent) => {
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                movedRef.current = true;
            }

            setPosition({
                right: dragStartRef.current.right - dx,
                bottom: dragStartRef.current.bottom - dy,
            });
        };

        const handlePointerUp = () => {
            setIsDragging(false);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [isDragging]);

    return (
        <div
            className="fixed z-50 flex flex-col items-end"
            style={{
                right: position.right,
                bottom: position.bottom,
                position: "fixed",
            }}
        >
            {isOpen && (
                <div className="mb-2">
                    <ChatWindow
                        onClose={() => setIsOpen(false)}
                        onDragStart={handlePointerDown}
                    />
                </div>
            )}
            <div className="flex justify-end">
                <button
                    onClick={handleClick}
                    onPointerDown={handlePointerDown}
                    className="bg-primary text-white w-16 h-16 flex items-center justify-center rounded-full shadow-xl cursor-pointer group touch-none select-none"
                >
                    {isOpen ? (
                        <X className="w-10 h-10 transition-transform duration-200 group-hover:scale-125" />
                    ) : (
                        <Bot className="w-10 h-10 transition-transform duration-200 group-hover:scale-125" />
                    )}
                </button>
            </div>
        </div>
    );
}
