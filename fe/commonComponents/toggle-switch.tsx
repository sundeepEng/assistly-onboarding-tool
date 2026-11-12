import React, { useState, useEffect } from "react";

export default function ToggleSwitch({ label = "", onToggle, defaultEnabled = false }) {
  const [enabled, setEnabled] = useState(defaultEnabled);

  useEffect(() => {
    setEnabled(defaultEnabled);
  }, [defaultEnabled]);

  const toggle = () => {
    setEnabled((prev) => !prev);
    if (onToggle) onToggle(!enabled);
  };

  return (
    <div className="flex items-center gap-4 font-poppins">
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={toggle}
        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${enabled ? "bg-primary" : "bg-primary/20"
          }`}
        type="button"
      >
        <div
          className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${enabled ? "translate-x-6" : "translate-x-0"
            }`}
        />
      </button>
    </div>
  );
}
