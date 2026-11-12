import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  checklistForFlow,
  FLOW_LABELS,
  listFlows,
} from "../../utils/onboarding/registry";
import { useOnboarding } from "./onboarding-provider";

const StepsPanel = () => {
  const {
    flowId,
    setFlowId,
    activeStepId,
    pendingStepId,
    verified,
    navigateToStep,
  } = useOnboarding();

  const flows = useMemo(listFlows, []);
  const modules = useMemo(() => checklistForFlow(flowId), [flowId]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const total = modules.reduce(
    (n, m) => n + m.screens.reduce((k, s) => k + s.steps.length, 0),
    0
  );
  const done = modules.reduce(
    (n, m) =>
      n +
      m.screens.reduce(
        (k, s) => k + s.steps.filter((st) => verified.has(st.step_id)).length,
        0
      ),
    0
  );

  const toggleModule = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isOpen = (id: string) =>
    expanded.size === 0 || expanded.has(id);

  return (
    <div className="h-full flex flex-col bg-white border-r border-black/10">
      <div className="px-5 pt-5 pb-4 border-b border-black/5">
        <h2 className="text-lg font-bold text-[#111827]">Onboarding</h2>
        <select
          value={flowId}
          onChange={(e) => setFlowId(e.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary"
        >
          {flows.map((f) => (
            <option key={f.flow_id} value={f.flow_id}>
              {FLOW_LABELS[f.flow_id] ?? f.flow_id}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-500 mt-2">
          {done} of {total} steps verified
        </p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {modules.map((mod) => (
          <div key={mod.module_id} className="mb-2">
            <button
              onClick={() => toggleModule(mod.module_id)}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50 transition"
            >
              <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {mod.title}
              </span>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${isOpen(mod.module_id) ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen(mod.module_id) &&
              mod.screens.map((screen) => (
                <div key={screen.screen_id} className="ml-2 mb-1">
                  <div className="px-2 py-1 text-sm font-semibold text-[#111827]">
                    {screen.title}
                  </div>
                  <div className="ml-[11px] border-l border-gray-200 pl-3 space-y-0.5">
                    {screen.steps.map((step) => {
                      const doneStep = verified.has(step.step_id);
                      const current =
                        step.step_id === activeStepId ||
                        step.step_id === pendingStepId;
                      return (
                        <button
                          key={step.step_id}
                          onClick={() => navigateToStep(step.step_id)}
                          className={`w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition
                            ${current ? "bg-primary/10 text-primary font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full
                              ${doneStep ? "bg-primary text-white" : current ? "border-2 border-primary" : "border border-gray-300"}`}
                          >
                            {doneStep && <Check size={10} />}
                          </span>
                          <span
                            className={doneStep ? "line-through opacity-70" : ""}
                          >
                            {step.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepsPanel;
