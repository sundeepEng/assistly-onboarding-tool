"use client";

import React, { useEffect, useState } from "react";
import Popover from "react-popover";

interface PopoverComponentType {
    children: React.ReactNode;
    body: React.ReactNode;
    isOpen?: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    triggerOnHover?:boolean
    zIndex?:number
}

const PopoverComponent = ({
    children,
    body,
    isOpen,
    setIsOpen,
    triggerOnHover,
    zIndex
}: PopoverComponentType) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => setHasMounted(true), []);

  const handleMouseEnter = () => setIsOpen(true);
  const handleMouseLeave = () => setIsOpen(false);
  const handleOnClick = () => setIsOpen(!isOpen);

  const triggerProps = triggerOnHover
    ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
    : { onClick: handleOnClick };

  if (!hasMounted) {
    return <div {...triggerProps}>{children}</div>;
  }

  return (
    <Popover
      isOpen={!!isOpen}
      preferPlace="below"
      appendTarget={document.body}
      style={{ zIndex: zIndex ||40 }}
      body={
        <div
          className="p-4 bg-white shadow-lg border rounded-md"
          style={{ zIndex: 20000 }}
          onMouseEnter={triggerOnHover ? handleMouseEnter : undefined}
          onMouseLeave={triggerOnHover ? handleMouseLeave : undefined}
        >
          {body}
        </div>
      }
      onOuterAction={() => setIsOpen(false)}
    >
      <div {...triggerProps}>{children}</div>
    </Popover>
  );
};

export default PopoverComponent;