import {
  eligibleStepIds,
  flowSteps,
  getFlow,
  getStep,
  nextEligibleStep,
  pathForStep,
  RegistryStep,
} from "./registry";

export type ViewHint = {
  flow_id?: string;
  active_step_id?: string;
  screen_id?: string;
  tab?: string;
};

export type GiaReply = {
  message: string;
  navigation: { step_id: string; path: string } | null;
  intent: "explain" | "continue" | "open_step" | "none";
};

const md = (s: string) => s.replace(/\*\*/g, "");

const stepCard = (s: RegistryStep) =>
  `**${s.title}** (${s.module_title} → ${s.screen_title})\n${md(s.guidance)}`;

const wantsDone = (t: string) =>
  /\b(done|finished|complete[ds]?|next step|move on|what'?s next)\b/i.test(t) ||
  // bare confirmations — "yeah", "it exists", "it's already there", "I did it"
  /^\s*(yes|yeah|yep|yup|ok(ay)?|sure|correct|confirmed|it'?s (there|done|exists|already there|in (clinical|crm))|it (exists|worked|shows up)|the (record|resident|lead|user) (exists|is there|shows up)|i (did|see|found|confirmed) (it|that|them|this))\b/i.test(
    t
  );
const wantsOpen = (t: string) =>
  /\b(open|go to|take me|navigate|show me|jump to)\b/i.test(t);

const matchStepByText = (flowId: string, text: string): RegistryStep | null => {
  const lower = text.toLowerCase();
  return (
    flowSteps(flowId).find((s) =>
      s.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((w) => lower.includes(w))
    ) ?? null
  );
};

/**
 * Deterministic Gia responder. Used when Lyzr credentials are not configured,
 * and as the authoritative post-processor for navigation even when Lyzr is:
 * the agent may only request a step_id from the eligible list; the path is
 * always resolved here from the registry, never taken from agent text.
 */
export function respondToMessage(
  rawMessage: string,
  view: ViewHint,
  verified: ReadonlySet<string>,
  agentProposal?: { intent?: string; step_id?: string; message?: string }
): GiaReply {
  const message = (rawMessage || "").trim();
  const flowId = view.flow_id && getFlow(view.flow_id) ? view.flow_id : null;
  if (!flowId) {
    return {
      intent: "explain",
      message:
        "Pick an onboarding flow on the left first — for example “New senior lead” — and I’ll guide you through it.",
      navigation: null,
    };
  }

  const eligible = new Set(eligibleStepIds(flowId));
  const active =
    view.active_step_id && eligible.has(view.active_step_id)
      ? getStep(view.active_step_id)!
      : flowSteps(flowId).find((s) => !verified.has(s.step_id)) ?? null;

  const proposalStep =
    agentProposal?.step_id && eligible.has(agentProposal.step_id)
      ? getStep(agentProposal.step_id)!
      : null;
  const proposalText = agentProposal?.message?.trim();

  const navTo = (step: RegistryStep, msg: string): GiaReply => ({
    intent: "open_step",
    message: msg,
    navigation: { step_id: step.step_id, path: pathForStep(step.step_id)! },
  });

  if (wantsDone(message) || agentProposal?.intent === "continue") {
    // Continue from the step the session actually committed — when nothing
    // is active yet, "next" is the flow's first unverified step.
    const cursor =
      view.active_step_id && eligible.has(view.active_step_id)
        ? view.active_step_id
        : null;
    const next = nextEligibleStep(flowId, cursor, verified);
    if (!next) {
      return {
        intent: "continue",
        message:
          "That was the last step in this flow. Once the record is confirmed in the app it will be marked verified here.",
        navigation: null,
      };
    }
    if (next.step_id === active?.step_id && cursor) {
      return {
        intent: "explain",
        message: `You’re still on:\n${stepCard(next)}\nOpening the screen doesn’t complete the step — it’s verified by the application once the work is confirmed.`,
        navigation: null,
      };
    }
    return navTo(
      next,
      `Next up: **${next.title}** (${next.module_title} → ${next.screen_title}). ${md(next.guidance)}`
    );
  }

  if (agentProposal?.intent === "open_step" && proposalStep) {
    return navTo(
      proposalStep,
      `Let’s open **${proposalStep.title}** (${proposalStep.module_title} → ${proposalStep.screen_title}). ${md(proposalStep.guidance)}`
    );
  }

  if (wantsOpen(message)) {
    const target = matchStepByText(flowId, message);
    if (target)
      return navTo(
        target,
        `Let’s open **${target.title}** (${target.module_title} → ${target.screen_title}). ${md(target.guidance)}`
      );
    return {
      intent: "explain",
      message:
        "I can open any step listed in the checklist — say its name, for example “open Prepare senior agreements”.",
      navigation: null,
    };
  }

  if (!active) {
    return {
      intent: "explain",
      message: "Every step in this flow is verified — you’re all set.",
      navigation: null,
    };
  }
  const viewScreen = view.screen_id;
  const mismatch =
    viewScreen && viewScreen !== active.screen_id
      ? `Heads up: the dashboard is showing “${viewScreen}”, but this step happens under ${active.module_title} → ${active.screen_title}. Say “open it” and I’ll take you there.\n\n`
      : "";
  return {
    intent: "explain",
    message:
      mismatch +
      (proposalText ??
        `You’re on:\n${stepCard(active)}\n\nSteps are verified by the application — opening a screen doesn’t mark them done.`),
    navigation: null,
  };
}
