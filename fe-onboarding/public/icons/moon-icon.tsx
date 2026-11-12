import React from "react";

const MoonIcon = ({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) => {
  return (
    <div title={title} className={className}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-4 h-4"
      >
        <path d="M14.438 10.148c.19-.425-.321-.787-.748-.601A5.5 5.5 0 0 1 6.453 2.31c.186-.427-.176-.938-.6-.748a6.501 6.501 0 1 0 8.585 8.586Z" />
      </svg>
    </div>
  );
};

export default MoonIcon;
