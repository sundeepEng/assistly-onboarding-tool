'use client'
import React from "react";
import dynamic from 'next/dynamic';

// Dynamically import the TailSpin component with SSR disabled
const TailSpin = dynamic(
  () => import('react-loader-spinner').then((mod) => mod.TailSpin),
  { ssr: false }
);

type LoaderProps = {
  /** Show full-page loader (default true) */
  fullScreen?: boolean;
  /** Show spinner (default true) */
  spinner?: boolean;
  /** Custom text */
  message?: string;
  /** Spinner size */
  size?: number;
};

const Loader: React.FC<LoaderProps> = ({
  fullScreen = true,
  spinner = true,
  message = "Loading...",
  size = 50,
}) => {
  const content = (
    <div className="flex flex-col items-center gap-4">
      {spinner && (
        <TailSpin height={size} width={size} color="#514ceb" strokeWidth="4px" />
      )}
      {message && (
        <p className="text-[#514ceb] text-lg font-medium animate-pulse">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen font-poppins">
        {content}
      </div>
    );
  }

  // Inline (e.g., tabs, cards, table sections)
  return (
    <div className="flex items-center justify-center w-full h-full p-4 font-poppins rounded">
      {content}
    </div>
  );
};

export default Loader;
