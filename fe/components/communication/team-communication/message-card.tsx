import { useEffect, useMemo, useRef, useState } from "react";
import "react-chat-elements/dist/main.css";
import { MessageBox } from "react-chat-elements";
import Button from "../../../commonComponents/button";
import { getInitials } from "../../../utils/getSignatureUtil";
import useGetAll from "../../../services/getAll";
import { getConversationsPath, TEAM_COMMUNICATION } from "../../../utils/constants";
import { useGetByIdTeamCommunication } from "../../../services/getById";
import { v4 as uuidv4 } from "uuid";
import Loader from "../../../commonComponents/loader";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";

/* ---------- Types ---------- */
type User = { userId: string; name: string; profileImageUrl?: string | null };

type ApiConversation = {
  conversation_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  created_at: string;
  updated_at: string;
  home_id: string;
  sender_user_name: string;
  receiver_user_name: string;
};

type ApiMessage = {
  conversation_id: string;
  message_id: string;
  message: string;
  sender_user_id: string;
  /** received from server only */
  created_at?: string;
};

type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
};

type SendMessagePayload = {
  action: "sendMessage";
  conversation_id: string;
  home_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  message: string;
  message_id: string;
};

/* ---------- Helpers ---------- */
const toApiMessage = (raw: any): ApiMessage | null => {
  // Server broadcasts a plain object (no action)
  const b = raw?.data ?? raw;
  if (!b?.conversation_id || !b?.message_id || !b?.message || !b?.sender_user_id) return null;
  return {
    conversation_id: b.conversation_id,
    message_id: b.message_id,
    message: b.message,
    sender_user_id: b.sender_user_id,
    created_at: b.created_at, // do not synthesize
  };
};

const mkWsUrl = (base: string, userId: string) =>
  base ? `${base.split("?")[0].replace(/\/+$/, "")}?userId=${encodeURIComponent(userId)}` : "";

/* ============================================
   Component
   ============================================ */
export function MessageCard({ users }: { users: User[] }) {
  const homeId = getHomeIdFromToken() || "";
  const currentUserId = getUserIdFromToken() || "";
  const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "";

  // Left pane members (exclude current user)
  const members = useMemo(
    () => users.filter((u) => u.userId !== currentUserId),
    [users, currentUserId]
  );
  const [activeMember, setActiveMember] = useState<User | null>(members[0] ?? null);

  // Temp conversation IDs for brand-new chats (keyed by peer userId)
  const [tempConvos, setTempConvos] = useState<Record<string, string>>({});
  // ref to read latest tempConvos inside WS callbacks
  const tempConvosRef = useRef(tempConvos);
  useEffect(() => {
    tempConvosRef.current = tempConvos;
  }, [tempConvos]);

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  /* -------- Conversations (GET) -------- */
  const {
    data: allConvos,
    refetch: refetchConvos,
    isLoading: conversationsLoading,
  } = useGetAll({
    key: TEAM_COMMUNICATION,
    params: { homeId, userId: currentUserId },
    path: getConversationsPath,
  });
  const conversations: ApiConversation[] = allConvos?.conversations ?? [];

  // Find active conversation ID from server
  const activeConversationId = useMemo(() => {
    if (!activeMember) return null;
    const found = conversations.find(
      (c) =>
        (c.sender_user_id === currentUserId && c.receiver_user_id === activeMember.userId) ||
        (c.sender_user_id === activeMember.userId && c.receiver_user_id === currentUserId)
    );
    return found?.conversation_id ?? null;
  }, [conversations, currentUserId, activeMember]);

  // Effective conversation ID (server ID or temp ID)
  const effectiveConversationId = useMemo(() => {
    if (!activeMember) return null;
    return activeConversationId ?? tempConvos[activeMember.userId] ?? null;
  }, [activeConversationId, tempConvos, activeMember]);

  // Clean up temp conversation ID once server ID appears
  useEffect(() => {
    if (!activeMember || !activeConversationId) return;
    if (tempConvos[activeMember.userId]) {
      setTempConvos((prev) => {
        const next = { ...prev };
        delete next[activeMember.userId];
        return next;
      });
    }
  }, [activeConversationId, activeMember, tempConvos]);

  /* -------- Messages (GET) -------- */
  const {
    data: convMsgs,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useGetByIdTeamCommunication({
    key: TEAM_COMMUNICATION,
    payload: {
      path: activeConversationId
        ? `/v1/hcm/communication/conversation/${activeConversationId}/messages`
        : "",
      enabled: !!activeConversationId,
    },
  });

  const serverMessages: ApiMessage[] = useMemo(
    () => (convMsgs?.messages as ApiMessage[] | undefined) ?? [],
    [convMsgs]
  );

  /* -------- Optimistic messages -------- */
  const [optimistic, setOptimistic] = useState<ApiMessage[]>([]);

  // Clear optimistic messages when switching active member
  useEffect(() => {
    setOptimistic([]);
  }, [activeMember?.userId]);

  // Merge server + optimistic messages for current conversation
  const conversation: ChatMessage[] = useMemo(() => {
    if (!activeMember || !effectiveConversationId) return [];

    const byId = new Map<string, ApiMessage>();

    // Add server messages
    for (const m of serverMessages) {
      if (m?.message_id) byId.set(m.message_id, m);
    }

    // Add optimistic messages (only for current conversation, not duplicates)
    const relevantOptimistic = optimistic.filter(
      (m) => m.conversation_id === effectiveConversationId
    );
    for (const m of relevantOptimistic) {
      if (m?.message_id && !byId.has(m.message_id)) {
        byId.set(m.message_id, m);
      }
    }

    // Sort by creation time
    const merged = Array.from(byId.values()).sort(
      (a, b) => (Date.parse(a.created_at || "") || 0) - (Date.parse(b.created_at || "") || 0)
    );

    return merged.map((m) => ({
      id: m.message_id,
      senderId: m.sender_user_id,
      receiverId: m.sender_user_id === currentUserId ? activeMember.userId : currentUserId,
      text: m.message,
      createdAt: m.created_at || new Date().toISOString(),
    }));
  }, [serverMessages, optimistic, effectiveConversationId, activeMember, currentUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length, activeMember?.userId]);

  /* -------- WebSocket: Single persistent connection -------- */
  const wsRef = useRef<WebSocket | null>(null);
  const sendQueueRef = useRef<SendMessagePayload[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  /** prevent duplicate onmessage handling */
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  /** keep URL stable */
  const wsUrl = useMemo(() => mkWsUrl(WS_BASE, currentUserId), [WS_BASE, currentUserId]);

  useEffect(() => {
    if (!currentUserId || !wsUrl) return;

    // Prevent multiple connections (StrictMode/dynamic deps)
    if (wsRef.current) {
      console.debug("[WS] Reuse existing connection");
      return;
    }

    let unmounted = false;

    const clearReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const connect = () => {
      if (unmounted) return;
      clearReconnect();

      // Safety: if we already have a socket, don't create another
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // console.log("[WS] Connection opened");
        reconnectAttemptsRef.current = 0;

        // Flush queued messages
        while (sendQueueRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
          const payload = sendQueueRef.current.shift();
          if (!payload) break;
          try {
            ws.send(JSON.stringify(payload));
            // console.log("[WS] Flushed queued message:", payload.message_id);
          } catch (err) {
            console.error("[WS] Error sending queued message:", err);
            sendQueueRef.current.unshift(payload);
            break;
          }
        }
      };

      ws.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data);
          const msg = toApiMessage(raw);
          if (!msg) return;

          // Ignore duplicates by message_id
          if (msg.message_id && seenMessageIdsRef.current.has(msg.message_id)) {
            return;
          }
          if (msg.message_id) {
            seenMessageIdsRef.current.add(msg.message_id);
          }

          //  Ensure the recipient client knows which conversation this belongs to
          // Determine the peer for this message:
          // - If it's from me (unlikely here, since server doesn't echo to sender), peer is active member
          // - Otherwise, peer is the sender of the message
          const peerId =
            msg.sender_user_id === currentUserId
              ? activeMember?.userId
              : msg.sender_user_id;

          if (peerId && !tempConvosRef.current[peerId]) {
            // set temp mapping so effectiveConversationId resolves
            setTempConvos((prev) => {
              if (prev[peerId]) return prev;
              return { ...prev, [peerId]: msg.conversation_id };
            });
          }

          // console.log("[WS] Received message:", msg);

          // Add to optimistic state (deduplication handled in useMemo too)
          setOptimistic((prev) => {
            const exists = msg.message_id && prev.some((x) => x.message_id === msg.message_id);
            return exists ? prev : [...prev, msg];
          });

          // Refresh conversations to update last message/timestamp
          refetchConvos?.();
        } catch (err) {
          console.error("[WS] Message parse error:", err);
        }
      };

      ws.onclose = (e) => {
        // console.log("[WS] Connection closed:", e.code, e.reason);
        wsRef.current = null;
        if (unmounted) return;

        // Attempt reconnection with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        // console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        clearReconnect();
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error("[WS] WebSocket error:", err);
      };
    };

    connect();

    return () => {
      unmounted = true;
      // console.log("[WS] Cleanup - closing connection");
      clearReconnect();
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
    //  Only depend on URL & user — NOT on refetchConvos (function identity is unstable)
  }, [currentUserId, wsUrl]);

  /* -------- Send Message -------- */
  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeMember) return;

    // Determine conversation ID (existing or new temp)
    const existingTemp = tempConvos[activeMember.userId];
    const conversation_id = activeConversationId ?? existingTemp ?? uuidv4();

    // Create temp conversation if needed
    if (!activeConversationId && !existingTemp) {
      setTempConvos((prev) => ({ ...prev, [activeMember.userId]: conversation_id }));
    }

    const message_id = uuidv4();

    // Prevent duplicate handling if server ever echoes to sender later
    seenMessageIdsRef.current.add(message_id);

    // Add optimistic message
    const optimisticMsg: ApiMessage = {
      conversation_id,
      message_id,
      message: text,
      sender_user_id: currentUserId,
      created_at: new Date().toISOString(),
    };
    setOptimistic((prev) => [...prev, optimisticMsg]);
    setDraft("");

    // Prepare payload
    const payload: SendMessagePayload = {
      action: "sendMessage",
      conversation_id,
      home_id: homeId,
      sender_user_id: currentUserId,
      receiver_user_id: activeMember.userId,
      message: text,
      message_id,
    };

    // console.log("[WS] Sending message:", payload);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
        // console.log("[WS] Message sent successfully");
      } catch (err) {
        console.error("[WS] Send error, queueing message:", err);
        sendQueueRef.current.push(payload);
      }
    } else {
      // console.log("[WS] Socket not open, queueing message (state:", ws?.readyState, ")");
      sendQueueRef.current.push(payload);
    }

    // Refresh to sync with server
    setTimeout(() => {
      if (activeConversationId) {
        refetchMessages?.();
      }
      refetchConvos?.();
    }, 500);
  };

  /* ================== JSX ================== */
  return (
    <div className="flex w-[1000px] h-[600px] border rounded-lg overflow-hidden">
      {/* Team Members */}
      <div className="w-[233px] border-r-4 border-solid border-r-[#D9D9D9] p-2 bg-[#f3f4f6]">
        <div className="flex flex-col gap-2 overflow-y-auto h-[540px]">
          {members.map((member) => {
            const isActive = member.userId === activeMember?.userId;
            return (
              <div
                key={member.userId}
                onClick={() => setActiveMember(member)}
                className={`flex gap-2 items-center text-left rounded-md px-2 py-2 cursor-pointer ${
                  isActive ? "font-bold" : ""
                }`}
              >
                <div className="h-10 w-10 rounded-full border-2 border-[#3089AB] border-solid flex items-center justify-center shrink-0">
                  {member.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="h-[40px] w-[40px] object-cover rounded-full"
                      loading="lazy"
                      width={40}
                      height={40}
                      alt={`${member.name} avatar`}
                      src={member.profileImageUrl}
                    />
                  ) : (
                    <h3 className="font-medium text-center text-lg">
                      {getInitials(member.name)}
                    </h3>
                  )}
                </div>
                <div className="flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap">
                  <p className="m-0 truncate max-w-[150px]" title={member.name}>
                    {member.name.length > 15
                      ? `${member.name.substring(0, 15)}...`
                      : member.name}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b-[1px] border-solid border-[#D9D9D9] px-2 h-[55px]">
          <div className="h-10 w-10 rounded-full border-2 border-[#3089AB] border-solid flex items-center justify-center shrink-0">
            {activeMember?.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="h-[40px] w-[40px] object-cover rounded-full"
                loading="lazy"
                width={40}
                height={40}
                alt={`${activeMember.name} avatar`}
                src={activeMember.profileImageUrl}
              />
            ) : (
              <h3 className="font-medium text-center text-lg">
                {activeMember ? getInitials(activeMember.name) : "?"}
              </h3>
            )}
          </div>
          <h3 className="text-[18px] font-bold">
            {activeMember?.name ?? "Select a user"}
          </h3>
        </div>

        {/* Messages */}
        {messagesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader fullScreen={false} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mb-2 pr-1">
            {activeMember && conversation?.length === 0 ? (
              <div className="p-10 text-sm text-gray-500 flex items-center justify-center">
                No conversation yet with &nbsp; <b> {activeMember?.name}</b>. Say hello!
              </div>
            ) : (
              conversation.map((msg) => {
                const isIncoming = activeMember && msg.senderId === activeMember.userId;
                return (
                  <div
                    key={msg?.id}
                    className={`flex ${isIncoming ? "justify-start" : "justify-end"} mb-2`}
                  >
                    <div className="max-w-[70%]">
                      <MessageBox
                        position={isIncoming ? "left" : "right"}
                        type="text"
                        text={msg.text}
                        date={new Date(msg.createdAt)}
                        notch
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 px-2 pb-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 border border-[#D9D9D9] border-solid rounded-lg px-4 py-4 outline-none text-[16px]"
            placeholder={activeMember ? "Type a message..." : "Select a user to start chatting"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!activeMember}
          />
          <Button buttonClick={sendMessage} name="Send" />
        </div>
      </div>
    </div>
  );
}
