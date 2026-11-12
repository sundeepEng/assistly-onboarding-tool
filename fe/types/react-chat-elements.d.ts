// types/react-chat-elements.d.ts
declare module "react-chat-elements" {
  import * as React from "react";

  export type MessageBoxPosition = "left" | "right";
  export type MessageBoxKind =
    | "text"
    | "photo"
    | "file"
    | "system"
    | "location"
    | "audio"
    | "video";

  export interface MessageBoxProps {
    position: MessageBoxPosition;
    type: MessageBoxKind;
    text?: string;
    date?: Date;
    notch?: boolean;

    // Make the noisy fields optional to match actual runtime usage
    id?: string | number;
    title?: string;
    focus?: boolean;
    titleColor?: string;
    status?: string;
    retracted?: boolean;
    forwarded?: boolean;
    dateString?: string;
    replyButton?: boolean;
    removeButton?: boolean;
    onReplyMessageClick?: () => void;
    onRemoveMessageClick?: () => void;

    [key: string]: any;
  }

  export const MessageBox: React.FC<MessageBoxProps>;
  export const ChatList: React.FC<any>;
  export const Input: React.FC<any>;
}
