import registryJson from "../generated/onboarding-registry.json";

export type GiaRegistryStep = {
  step_id: string;
  title: string;
  guidance: string;
  kind: string;
  screen_id: string;
  screen_path: string;
  module_id: string;
};

type GiaRegistry = {
  steps: Record<string, GiaRegistryStep>;
  screens: Record<string, { screen_id: string; path: string }>;
};

const registry = registryJson as unknown as GiaRegistry;

const pathToScreen = new Map<string, string>();
for (const s of Object.values(registry.screens)) {
  if (!pathToScreen.has(s.path)) pathToScreen.set(s.path, s.screen_id);
}

export const getGiaStep = (stepId: string): GiaRegistryStep | undefined =>
  registry.steps[stepId];

/** Resolve a step to its dashboard path — the only navigation authority. */
export const pathForGiaStep = (stepId: string): string | null =>
  registry.steps[stepId]?.screen_path ?? null;

/** Map the current router pathname to a registry screen_id, if any. */
export const screenForPath = (pathname: string): string | null => {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (pathToScreen.has(clean)) return pathToScreen.get(clean)!;
  // detail pages like /crm/[leadId] map to the board of the same module
  for (const [path, screenId] of pathToScreen) {
    if (clean.startsWith(path + "/")) return screenId;
  }
  return null;
};
