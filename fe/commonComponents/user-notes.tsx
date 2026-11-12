// components/UserPopover.tsx
import React from "react";

const UserPopover = ({
  note,
  textClass = "",
  onChange,
}: {
  note: string;
  onChange: (value: string) => void;
  textClass?: string;
}) => {
  return (
    <div className="flex flex-col px-3 pt-3 rounded-md bg-white shadow-md w-[250px]">
      <div className="border border-gray-300 rounded-md">
        <textarea
          maxLength={500}
          className={`w-full h-[100px] resize-none border p-2 font-poppins rounded focus:outline-none focus:ring ${textClass}`}
          placeholder="Add a note..."
          value={note}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="text-[9px] text-right">({note?.length}/500)</div>
    </div>
  );
};

export default UserPopover;
