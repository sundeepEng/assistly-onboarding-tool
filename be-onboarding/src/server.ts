import "dotenv/config";
import http from "http";
import { authenticate, AuthContext } from "./auth";
import {productState, selectProduct, productReply} from "./product-walkthrough";

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
    req.on("data", (c) => { data += c; if (data.length > 16384) { reject(new Error("Request too large")); req.destroy(); } });
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
      signal: AbortSignal.timeout(15000),
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
  ).catch(() => null);
  if (!auth) return json(res, 401, { error: "Not authenticated" });

  try {
    if (req.method === "GET" && path === "/walkthrough") return json(res, 200, await productState(auth));
    if (req.method === "POST" && path === "/walkthrough/select") {
      const body = await readBody(req);
      const state = await productState(auth);
      const target = state.screens.find(s => s.screen_id === body.screen_id);
      if (!target) return json(res, 403, {error:"Screen unavailable"});
      return json(res, 200, await selectProduct(auth, target.screen_id, body.task_id, body.acknowledge === true));
    }
    if (req.method === "POST" && path === "/walkthrough/chat") {
      const body = await readBody(req);
      const message = String(body.message ?? "").trim();
      if (!message || message.length > 4000) return json(res, 400, {error:"Invalid message"});
      const state = await productState(auth);
      const next = state.screens[state.screens.findIndex(s => s.screen_id === state.selected?.screen_id)+1] ?? null;
      const proposal = await callLyzr({userId: `${auth.userId}:${auth.homeId}`, prompt: [
        "You are Gia. Explain product navigation. Do not infer tabs, forms or records from the selected checklist screen. Do not mark actions complete. Record questions do not advance the tour.",
        JSON.stringify({selected_screen:state.selected,selected_task:state.task,next_screen:next,eligible_screens:state.screens}),
        'Return JSON {"intent":"explain|continue|open_step","message":"...","step_id":"eligible ID"}. Never invent paths.',
        `User question: ${message}`].join("\n")});
      return json(res, 200, productReply(message, state, proposal ?? undefined));
    }
    // Legacy record-flow endpoints are not exposed in the product release.
    return json(res, 404, {error:"not found"});
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
