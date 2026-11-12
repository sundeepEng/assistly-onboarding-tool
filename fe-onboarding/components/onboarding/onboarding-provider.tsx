import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Cookies from "js-cookie";
import { ID_TOKEN } from "../../utils/constants";
import {
  buildNavigate,
  GIA_READY,
  isNavigationResult,
  isPageChanged,
  isRecordSaved,
} from "../../utils/onboarding/protocol";
import { getStep, listFlows } from "../../utils/onboarding/registry";

const DASHBOARD_ORIGIN =
  process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || "http://localhost:3001";
const API = process.env.NEXT_PUBLIC_ONBOARDING_API || "http://localhost:3100";

export type ChatMessage = { id: number; role: "user" | "agent"; text: string };

export type IframeView = {
  ready: boolean;
  path: string | null;
  screen_id: string | null;
  tab: string | null;
};

type SessionState = {
  session: {
    id: string;
    flow_id: string;
    active_screen_id: string | null;
    active_task_id: string | null;
    revision: number;
  };
  progress: {
    step_id: string;
    visit_count: number;
    acknowledged_at: string | null;
    verified_at: string | null;
  }[];
};

type OnboardingContextValue = {
  flowId: string;
  setFlowId: (f: string) => void;
  activeStepId: string | null;
  verified: ReadonlySet<string>;
  iframeView: IframeView;
  pendingStepId: string | null;
  navigateToStep: (stepId: string) => Promise<boolean>;
  registerIframe: (win: Window | null) => void;
  messages: ChatMessage[];
  sendChat: (text: string) => Promise<void>;
  chatBusy: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding outside provider");
  return ctx;
};

const apiFetch = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get(ID_TOKEN)}`,
      ...(init?.headers || {}),
    },
  });
  return res;
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [flowId, setFlowIdState] = useState(listFlows()[0]?.flow_id ?? "");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [iframeView, setIframeView] = useState<IframeView>({
    ready: false,
    path: null,
    screen_id: null,
    tab: null,
  });
  const [pendingStepId, setPendingStepId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "agent",
      text: "Hi! I’m Gia. Pick a flow on the left and I’ll walk you through onboarding.",
    },
  ]);
  const [chatBusy, setChatBusy] = useState(false);

  const iframeWin = useRef<Window | null>(null);
  const pending = useRef(new Map<string, string>()); // request_id -> step_id
  const boundRecord = useRef<string | null>(null);
  const verifiedRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<string | null>(null);
  const nextMsgId = useRef(1);
  sessionRef.current = sessionId;
  const flowRef = useRef(flowId);
  flowRef.current = flowId;

  const addAgentMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId.current++, role: "agent", text },
    ]);
  }, []);

  const registerIframe = useCallback((win: Window | null) => {
    iframeWin.current = win;
  }, []);

  const applyState = useCallback(
    (state: SessionState) => {
      setSessionId(state.session.id);
      setActiveStepId(state.session.active_task_id);
      const next = new Set(
        state.progress
          .filter((p) => p.verified_at)
          .map((p) => p.step_id)
      );
      // Announce steps the application just confirmed.
      for (const id of next) {
        if (!verifiedRef.current.has(id)) {
          const step = getStep(id);
          if (step) addAgentMessage(`Verified: **${step.title}** ✓`);
        }
      }
      verifiedRef.current = next;
      setVerified(next);
    },
    [addAgentMessage]
  );

  // Load/create the saved session whenever the flow changes. The same session
  // drives the checklist and every Gia chat turn.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch(
        `/onboarding/session?flow_id=${encodeURIComponent(flowId)}`
      );
      if (!res.ok || cancelled) return;
      const state: SessionState = await res.json();
      applyState(state);
    })();
    return () => {
      cancelled = true;
    };
  }, [flowId, applyState]);

  const setFlowId = useCallback((f: string) => {
    setFlowIdState(f);
    setPendingStepId(null);
    boundRecord.current = null;
    pending.current.clear(); // stale acks for the old flow are ignored
  }, []);

  const sendNavigate = useCallback((requestId: string, stepId: string) => {
    const win = iframeWin.current;
    if (!win) return false;
    pending.current.set(requestId, stepId);
    setPendingStepId(stepId);
    win.postMessage(buildNavigate(requestId, stepId), DASHBOARD_ORIGIN);
    return true;
  }, []);

  /** Manual checklist click or Gia intent — same server navigation service. */
  const navigateToStep = useCallback(
    async (stepId: string) => {
      const step = getStep(stepId);
      if (!step || !sessionId) {
        if (step)
          addAgentMessage(
            `Head to ${step.module_title} → ${step.screen_title} in the dashboard — the session isn’t ready yet.`
          );
        return false;
      }
      const res = await apiFetch("/onboarding/nav-request", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, step_id: stepId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        addAgentMessage("That step isn’t available in the current flow.");
        return false;
      }
      if (!iframeWin.current) {
        addAgentMessage(
          `Head to ${step.module_title} → ${step.screen_title} in the dashboard — the embedded view isn’t ready yet.`
        );
        return false;
      }
      return sendNavigate(data.request_id, data.step_id);
    },
    [sessionId, addAgentMessage, sendNavigate]
  );

  // Resume: once the dashboard says it's ready and the session has a
  // confirmed screen, reopen it.
  const resumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!iframeView.ready || !activeStepId || !sessionId) return;
    if (resumedRef.current === `${sessionId}:${activeStepId}`) return;
    resumedRef.current = `${sessionId}:${activeStepId}`;
    void navigateToStep(activeStepId);
  }, [iframeView.ready, activeStepId, sessionId, navigateToStep]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== DASHBOARD_ORIGIN) return;
      if (e.source !== iframeWin.current) return;
      const d = e.data;
      if (d?.type === GIA_READY) {
        setIframeView((v) => ({ ...v, ready: true }));
        return;
      }
      if (isPageChanged(d)) {
        setIframeView((v) => ({
          ...v,
          path: d.path,
          screen_id: d.screen_id,
          tab: d.tab ?? null,
        }));
        // The dashboard reports the selected record on detail routes — bind
        // the session to it so progress stays record-scoped.
        const recordId = d.record_id ?? null;
        if (recordId && recordId !== boundRecord.current && sessionRef.current) {
          boundRecord.current = recordId;
          const res = await apiFetch("/onboarding/bind-record", {
            method: "POST",
            body: JSON.stringify({
              session_id: sessionRef.current,
              record_id: recordId,
            }),
          });
          if (res.ok) {
            const body = await res.json();
            if (body.ok) applyState(body.state);
          }
        }
        return;
      }
      if (isRecordSaved(d)) {
        // A save only triggers re-evaluation — the backend decides what
        // counts as verified from application state.
        if (!sessionRef.current) return;
        const res = await apiFetch("/onboarding/evaluate", {
          method: "POST",
          body: JSON.stringify({ session_id: sessionRef.current }),
        });
        if (res.ok) applyState(await res.json());
        return;
      }
      if (isNavigationResult(d)) {
        const stepId = pending.current.get(d.request_id);
        if (!stepId) return; // stale/foreign ack — ignore
        pending.current.delete(d.request_id);

        // Commit (or reject) the acknowledgement server-side in one shot.
        const res = await apiFetch("/onboarding/nav-ack", {
          method: "POST",
          body: JSON.stringify({
            request_id: d.request_id,
            status: d.status,
          }),
        });
        if (res.ok) {
          const body = await res.json();
          if (body.ok) applyState(body.state);
          if (d.status === "ok") {
            setPendingStepId(null);
          } else {
            setPendingStepId((cur) => (cur === stepId ? null : cur));
            const step = getStep(stepId);
            addAgentMessage(
              d.status === "cancelled"
                ? "Navigation was cancelled — staying put. Your unsaved changes are safe."
                : d.message ||
                    `I couldn’t open ${step?.screen_title ?? "that screen"}.`
            );
          }
        } else if (res.status === 409) {
          // Stale acknowledgement — the session moved on; keep current state.
          setPendingStepId((cur) => (cur === stepId ? null : cur));
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [addAgentMessage, applyState]);

  const sendChat = useCallback(
    async (text: string) => {
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId.current++, role: "user", text },
      ]);
      setChatBusy(true);
      try {
        const res = await apiFetch("/gia/chat", {
          method: "POST",
          body: JSON.stringify({
            message: text,
            view: {
              flow_id: flowId,
              screen_id: iframeView.screen_id ?? undefined,
              tab: iframeView.tab ?? undefined,
            },
          }),
        });
        if (!res.ok) {
          addAgentMessage(
            res.status === 401
              ? "Your session expired — please log in again."
              : "Something went wrong reaching Gia. Try again."
          );
          return;
        }
        const reply = await res.json();
        addAgentMessage(reply.message);
        // Gia intents carry a server-issued request_id — use it directly.
        if (reply.navigation?.request_id) {
          sendNavigate(reply.navigation.request_id, reply.navigation.step_id);
        }
      } catch {
        addAgentMessage("Something went wrong reaching Gia. Try again.");
      } finally {
        setChatBusy(false);
      }
    },
    [flowId, iframeView, addAgentMessage, sendNavigate]
  );

  return (
    <OnboardingContext.Provider
      value={{
        flowId,
        setFlowId,
        activeStepId,
        verified,
        iframeView,
        pendingStepId,
        navigateToStep,
        registerIframe,
        messages,
        sendChat,
        chatBusy,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
