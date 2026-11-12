import registryJson from "../generated/onboarding-registry.json";

export type RegistryStep = {
  home_types: string[];
  permission_requirements: string[];
  step_id: string;
  title: string;
  guidance: string;
  kind: "onboarding" | "reference";
  completion_check_key: string | null;
  screen_id: string;
  screen_title: string;
  screen_path: string;
  module_id: string;
  module_title: string;
  module_path: string;
};

export type RegistryFlow = {
  flow_id: string;
  steps: string[];
  sequence_status: string;
};

type Registry = {
  schema_version: string;
  steps: Record<string, RegistryStep>;
  flows: Record<string, RegistryFlow>;
};

export const registry = registryJson as unknown as Registry;
export const SCHEMA_VERSION = registry.schema_version;

export const getStep = (id: string) => registry.steps[id];
export const getFlow = (id: string) => registry.flows[id];
export const pathForStep = (id: string) => registry.steps[id]?.screen_path ?? null;

export const flowSteps = (flowId: string): RegistryStep[] => {
  const flow = registry.flows[flowId];
  if (!flow) return [];
  return flow.steps.map((id) => registry.steps[id]).filter(Boolean);
};

export const eligibleStepIds = (flowId: string) =>
  flowSteps(flowId).map((s) => s.step_id);

export const nextEligibleStep = (
  flowId: string,
  currentStepId: string | null,
  verified: ReadonlySet<string>
): RegistryStep | null => {
  const steps = flowSteps(flowId);
  const idx = currentStepId
    ? steps.findIndex((s) => s.step_id === currentStepId)
    : -1;
  for (const step of steps.slice(idx + 1)) {
    if (!verified.has(step.step_id)) return step;
  }
  return null;
};

import permissions from "../generated/permissions.json";
export type Audience = {role: string | null; homeType: string};
export function allowedSteps(a: Audience): RegistryStep[] {
  const grants = (permissions as Record<string, string[]>)[a.role ?? ""] ?? [];
  return Object.values(registry.steps).filter(s => s.home_types.includes(a.homeType) && s.permission_requirements.every(p => grants.includes(p)));
}
export function walkthrough(a: Audience) {
  const allowed = allowedSteps(a);
  const grants = (permissions as Record<string, string[]>)[a.role ?? ""] ?? [];
  return flowSteps("walkthrough").map(entry => ({...entry, guidance: `Review ${entry.screen_title}. Expand eligible task help for instructions.`,
    tasks: allowed.filter(t => t.screen_id === entry.screen_id)
  })).filter(s => {
    const screen = (registryJson.screens as any)[s.screen_id];
    return screen.home_types.includes(a.homeType) && screen.permission_requirements.every((p: string) => grants.includes(p));
  });
}
