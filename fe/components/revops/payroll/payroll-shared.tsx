"use client";

import { Users } from "lucide-react";
import type { RevopsPayrollStaffMember } from "../../../utils/revops/mock-data";

export function StaffStatusPill({
  status,
}: {
  status: RevopsPayrollStaffMember["status"];
}) {
  return (
    <div className="px-[8px] py-[4px] rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold">
      {String(status)}
    </div>
  );
}

export function StaffAvatarIcon() {
  return (
    <div className="h-[44px] w-[44px] rounded-full bg-[#E8EEF6] flex items-center justify-center">
      <Users size={20} className="text-secondarymirage" />
    </div>
  );
}
