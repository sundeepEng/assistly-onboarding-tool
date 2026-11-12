import registryJson from "../generated/onboarding-registry.json";

export type OnboardingKind = "onboarding" | "reference";

export type RegistryStep = {
  step_id: string;
  title: string;
  guidance: string;
  kind: OnboardingKind;
  completion_check_key: string | null;
  screen_id: string;
  screen_title: string;
  screen_path: string;
  module_id: string;
  module_title: string;
  module_path: string;
};

export type RegistryScreen = {
  screen_id: string;
  title: string;
  path: string;
  module_id: string;
  module_title: string;
};

export type RegistryFlow = {
  flow_id: string;
  steps: string[];
  sequence_status: string;
};

type Registry = {
  schema_version: string;
  screens: Record<string, RegistryScreen>;
  steps: Record<string, RegistryStep>;
  flows: Record<string, RegistryFlow>;
};

const registry = registryJson as unknown as Registry;

export const FLOW_LABELS: Record<string, string> = {
  new_senior_lead: "New senior lead",
  existing_resident_migration: "Existing resident migration",
  care_lead_intake: "Care lead intake",
  nurse_lead_intake: "Nurse lead intake",
};

export const getStep = (stepId: string): RegistryStep | undefined =>
  registry.steps[stepId];

export const getFlow = (flowId: string): RegistryFlow | undefined =>
  registry.flows[flowId];

export const listFlows = (): RegistryFlow[] => Object.values(registry.flows);

export const isValidStepId = (stepId: unknown): stepId is string =>
  typeof stepId === "string" && stepId in registry.steps;

export const pathForStep = (stepId: string): string | null =>
  registry.steps[stepId]?.screen_path ?? null;

export const flowSteps = (flowId: string): RegistryStep[] => {
  const flow = registry.flows[flowId];
  if (!flow) return [];
  return flow.steps.map((id) => registry.steps[id]).filter(Boolean);
};

export type ChecklistModule = {
  module_id: string;
  title: string;
  screens: { screen_id: string; title: string; steps: RegistryStep[] }[];
};

/** Module -> screen -> steps, ordered by the flow's steps array. */
export const checklistForFlow = (flowId: string): ChecklistModule[] => {
  const modules: ChecklistModule[] = [];
  for (const step of flowSteps(flowId)) {
    let mod = modules.find((m) => m.module_id === step.module_id);
    if (!mod) {
      mod = { module_id: step.module_id, title: step.module_title, screens: [] };
      modules.push(mod);
    }
    let screen = mod.screens.find((s) => s.screen_id === step.screen_id);
    if (!screen) {
      screen = { screen_id: step.screen_id, title: step.screen_title, steps: [] };
      mod.screens.push(screen);
    }
    screen.steps.push(step);
  }
  return modules;
};

/**
 * Next eligible step: the first step after `currentStepId` in flow order that
 * is not verified. If currentStepId is unknown, returns the first unverified
 * step in the flow.
 */
export const nextEligibleStep = (
  flowId: string,
  currentStepId: string | null,
  verified: ReadonlySet<string>
): RegistryStep | null => {
  const steps = flowSteps(flowId);
  const currentIdx = currentStepId
    ? steps.findIndex((s) => s.step_id === currentStepId)
    : -1;
  for (const step of steps.slice(currentIdx + 1)) {
    if (!verified.has(step.step_id)) return step;
  }
  return null;
};

/** Steps the user may be navigated to within a flow (onboarding steps only). */
export const eligibleStepIds = (flowId: string): string[] =>
  flowSteps(flowId).map((s) => s.step_id);
