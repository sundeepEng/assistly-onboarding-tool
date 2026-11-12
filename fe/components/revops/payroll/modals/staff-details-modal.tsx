"use client";

import CommonModal from "../../../../commonComponents/common-modal";
import Button from "../../../../commonComponents/button";
import type { RevopsPayrollStaffMember } from "../../../../utils/revops/mock-data";
import { formatCurrency } from "../payroll-utils";
import { StaffAvatarIcon, StaffStatusPill } from "../payroll-shared";

export default function RevopsPayrollStaffDetailsModal({
  selectedStaff,
  setSelectedStaff,
}: {
  selectedStaff: RevopsPayrollStaffMember | null;
  setSelectedStaff: (staff: RevopsPayrollStaffMember | null) => void;
}) {
  return (
    <CommonModal
      title="Employee Details"
      modalOpen={selectedStaff != null}
      setModalOpen={(open) => {
        if (!open) setSelectedStaff(null);
      }}
      crossCTA
      width="700px"
    >
      {selectedStaff && (
        <div className="font-poppins px-[20px] w-[680px]">
          <div className="text-sm text-[#6B7280]">
            View employee information and compensation details.
          </div>

          <div className="mt-4 flex items-start gap-3">
            <StaffAvatarIcon />
            <div>
              <div className="text-base font-semibold text-[#111827]">
                {selectedStaff.name}
              </div>
              <div className="text-sm text-[#6B7280]">{selectedStaff.role}</div>
              <div className="mt-1 inline-flex">
                <StaffStatusPill status={selectedStaff.status} />
              </div>
            </div>
          </div>

          <div className="mt-4 h-[1px] bg-[#E5E7EB]" />

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="text-[#6B7280]">Employee ID</div>
            <div className="text-right font-semibold text-[#111827]">
              {selectedStaff.employeeId}
            </div>

            <div className="text-[#6B7280]">Hire Date</div>
            <div className="text-right font-semibold text-[#111827]">
              {selectedStaff.hireDate}
            </div>

            <div className="text-[#6B7280]">Hourly Rate</div>
            <div className="text-right font-semibold text-[#111827]">
              {formatCurrency(selectedStaff.hourlyRate)}/hr
            </div>

            <div className="text-[#6B7280]">Tenure</div>
            <div className="text-right font-semibold text-[#111827]">36 months</div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              name="Close"
              type="button"
              buttonClick={() => setSelectedStaff(null)}
              classname="!bg-white border border-[#E5E7EB] hover:!bg-gray-50"
              titleClass="!text-[#111827] !text-[12px]"
            />
          </div>
        </div>
      )}
    </CommonModal>
  );
}
