import React, { useEffect, useState } from "react";
import AssistlyLogo from "../public/icons/assistly";

type AiLoaderProps = {
  /** Primary message shown below the icon */
  message?: string;
  /** Secondary subtitle text */
  subtitle?: string;
  /** Size of the Assistly logo */
  logoSize?: number;
};

const DOTS_CYCLE = ["", ".", "..", "..."];

const BRAND_COLOR = "#514ceb";

const AiLoader: React.FC<AiLoaderProps> = ({
  message = "AI is analyzing",
  subtitle = "This may take a few seconds",
  logoSize = 48,
}) => {
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % DOTS_CYCLE.length);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-2">
      {/* Outer glow ring + spinning orbit */}
      <div className="relative flex items-center justify-center w-24 h-24">
        {/* Pulsing glow backdrop */}
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: BRAND_COLOR }}
        />
        {/* Spinning orbital ring */}
        <span
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: `2.5px solid transparent`,
            borderTopColor: BRAND_COLOR,
            borderRightColor: BRAND_COLOR,
            animationDuration: "1.2s",
          }}
        />
        {/* Static subtle ring */}
        <span
          className="absolute inset-1 rounded-full"
          style={{ border: `1.5px dashed ${BRAND_COLOR}33` }}
        />
        {/* Assistly logo – gentle pulse */}
        <div className="animate-pulse" style={{ animationDuration: "2s" }}>
          <AssistlyLogo size={logoSize} color="#514ceb" />
        </div>
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: BRAND_COLOR }}>
          {message}
          <span className="inline-block w-6 text-left">{DOTS_CYCLE[dotIndex]}</span>
        </p>
        {subtitle && (
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>

    </div>
  );
};

export default AiLoader;
