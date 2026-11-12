import "dotenv/config";
import http from "http";
import { authenticate, AuthContext } from "./auth";
import {
  acknowledgeNavRequest,
  bindRecord,
  createNavRequest,
  evaluateSession,
  getOrCreateSession,
} from "./session-service";
import {
  eligibleStepIds,
  flowSteps,
  getFlow,
} from "./registry";
import { respondToMessage, ViewHint } from "./gia-engine";

const PORT = Number(process.env.PORT || 3100);
const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || "http://localhost:3000";

const LYZR_API_URL =
  process.env.LYZR_API_URL ||
  "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";
const LYZR_AGENT_ID =
  process.env.LYZR_AGENT_ID || "6ae21c55cc968c7ed6846286";

const json = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": PORTAL_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
};

const readBody = (req: http.IncomingMessage): Promise<any> =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

async function callLyzr(params: {
  userId: string;
  prompt: string;
}): Promise<{ intent?: string; step_id?: string; message?: string } | null> {
  const apiKey = process.env.LYZR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(LYZR_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        user_id: params.userId,
        agent_id: LYZR_AGENT_ID,
        // One Lyzr session per user so the conversation stays in a single loop.
        session_id: params.userId,
        message: params.prompt,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.response ?? data?.message ?? "";
    const jsonStart = text.indexOf("{");
    if (jsonStart >= 0) {
      try {
        return JSON.parse(text.slice(jsonStart));
      } catch {
        /* fall through */
      }
    }
    return text ? { intent: "explain", message: text } : null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname;

  const auth: AuthContext | null = await authenticate(
    req.headers.authorization
  );
  if (!auth) return json(res, 401, { error: "Not authenticated" });

  try {
    // ---- Load (or create) the onboarding session -------------------------
    if (req.method === "GET" && path === "/onboarding/session") {
      const flowId = url.searchParams.get("flow_id");
      const subjectRecordId = url.searchParams.get("subject_record_id");
      if (!flowId || !getFlow(flowId))
        return json(res, 400, { error: "unknown flow_id" });
      const state = await getOrCreateSession({
        userId: auth.userId,
        homeId: auth.homeId,
        flowId,
        subjectRecordId,
      });
      // Resume is a natural moment to re-check application-verified progress.
      const evaluated = await evaluateSession({
        sessionId: state.session.id,
        userId: auth.userId,
        homeId: auth.homeId,
      });
      return json(res, 200, evaluated ?? state);
    }

    // ---- Bind the session to the record the user is working on -----------
    if (req.method === "POST" && path === "/onboarding/bind-record") {
      const body = await readBody(req);
      const recordId = String(body.record_id || "");
      if (!recordId) return json(res, 400, { error: "record_id is required" });
      const result = await bindRecord({
        sessionId: String(body.session_id || ""),
        userId: auth.userId,
        homeId: auth.homeId,
        recordId,
      });
      return json(
        res,
        result.ok ? 200 : result.status === "conflict" ? 409 : 404,
        result
      );
    }

    // ---- Re-evaluate completion checks (save/record events) --------------
    if (req.method === "POST" && path === "/onboarding/evaluate") {
      const body = await readBody(req);
      const state = await evaluateSession({
        sessionId: String(body.session_id || ""),
        userId: auth.userId,
        homeId: auth.homeId,
      });
      return json(res, state ? 200 : 404, state ?? { error: "session not found" });
    }

    // ---- Issue a navigation request (checklist click or Gia intent) ------
    if (req.method === "POST" && path === "/onboarding/nav-request") {
      const body = await readBody(req);
      const result = await createNavRequest({
        sessionId: String(body.session_id || ""),
        userId: auth.userId,
        homeId: auth.homeId,
        stepId: String(body.step_id || ""),
      });
      return json(res, result.ok ? 200 : 400, result);
    }

    // ---- Apply the iframe's navigation acknowledgement -------------------
    if (req.method === "POST" && path === "/onboarding/nav-ack") {
      const body = await readBody(req);
      const status = String(body.status || "");
      if (!["ok", "blocked", "cancelled", "error"].includes(status))
        return json(res, 400, { error: "invalid status" });
      const result = await acknowledgeNavRequest({
        requestId: String(body.request_id || ""),
        userId: auth.userId,
        homeId: auth.homeId,
        status: status as any,
      });
      return json(
        res,
        result.ok ? 200 : result.status === "stale" ? 409 : 404,
        result
      );
    }

    // ---- Gia chat ---------------------------------------------------------
    if (req.method === "POST" && path === "/gia/chat") {
      const body = await readBody(req);
      const message = String(body.message || "").trim();
      if (!message) return json(res, 400, { error: "message is required" });

      const v: ViewHint = {
        flow_id: typeof body.view?.flow_id === "string" ? body.view.flow_id : undefined,
        screen_id: typeof body.view?.screen_id === "string" ? body.view.screen_id : undefined,
        tab: typeof body.view?.tab === "string" ? body.view.tab : undefined,
      };
      if (!v.flow_id || !getFlow(v.flow_id)) {
        return json(res, 200, {
          intent: "explain",
          message:
            "Pick an onboarding flow on the left first — for example “New senior lead” — and I’ll guide you through it.",
          navigation: null,
        });
      }

      // The saved session is authoritative for the active step and progress.
      let state = await getOrCreateSession({
        userId: auth.userId,
        homeId: auth.homeId,
        flowId: v.flow_id,
        subjectRecordId:
          typeof body.subject_record_id === "string"
            ? body.subject_record_id
            : null,
      });
      state = (await evaluateSession({
        sessionId: state.session.id,
        userId: auth.userId,
        homeId: auth.homeId,
      })) ?? state;
      v.active_step_id = state.session.active_task_id ?? undefined;
      const verified = new Set(
        state.progress.filter((p) => p.verified_at).map((p) => p.step_id)
      );

      const eligible = flowSteps(v.flow_id).map((s) => ({
        step_id: s.step_id,
        title: s.title,
        screen: `${s.module_title} → ${s.screen_title}`,
        guidance: s.guidance,
        verified: verified.has(s.step_id),
      }));

      const proposal = await callLyzr({
        userId: auth.userId,
        prompt: [
          "You are Gia, an onboarding guide embedded in a portal.",
          `Signed-in user role: ${auth.role ?? "unknown"}; home: ${auth.homeId}.`,
          `Active flow: ${v.flow_id}; active step: ${
            v.active_step_id ?? "none"
          }; dashboard screen: ${v.screen_id ?? "unknown"}${
            v.tab ? `/${v.tab}` : ""
          }.`,
          `Eligible steps for this flow (choose step_id only from this list): ${JSON.stringify(
            eligible
          )}.`,
          'Reply with JSON only: {"intent":"explain|continue|open_step","message":"...","step_id":"<one eligible step_id, only for open_step>"}.',
          "Never include paths or URLs; the portal resolves navigation itself.",
          `User: ${message}`,
        ].join("\n"),
      });

      const reply = respondToMessage(message, v, verified, proposal ?? undefined);

      // Navigation intents get a server-issued request bound to this session.
      let navigation = null;
      if (reply.navigation) {
        const nav = await createNavRequest({
          sessionId: state.session.id,
          userId: auth.userId,
          homeId: auth.homeId,
          stepId: reply.navigation.step_id,
        });
        if (nav.ok) {
          navigation = {
            request_id: nav.request_id,
            step_id: nav.step_id,
            path: nav.path,
          };
        } else {
          return json(res, 200, {
            intent: "explain",
            message:
              "I can’t open that screen for this step right now — it isn’t available in the current flow.",
            navigation: null,
          });
        }
      }
      return json(res, 200, { ...reply, navigation });
    }

    return json(res, 404, { error: "not found" });
  } catch (e: any) {
    console.error(e);
    return json(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`onboarding-api listening on :${PORT}`);
  console.log(`portal origin: ${PORTAL_ORIGIN}`);
  console.log(
    `auth: ${
      process.env.AUTH_DEV_BYPASS === "1"
        ? "DEV BYPASS (unverified claims)"
        : process.env.COGNITO_USER_POOL_ID
          ? `cognito pool ${process.env.COGNITO_USER_POOL_ID}`
          : "MISCONFIGURED — set COGNITO_USER_POOL_ID"
    }`
  );
});
