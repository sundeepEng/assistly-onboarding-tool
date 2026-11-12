"use client";

import { useState } from "react";
import { Card } from "../../../commonComponents/card";
import { FileText } from "lucide-react";
import AddInvoiceModal from "./add-invoice";
import { InvoiceStatus } from "../../../utils/constants";
import Avatar from "../../../commonComponents/avatar";

interface ResidentCardProps {
  senior: any;
  invoices: any[];
  onInvoiceCreated?: (invoice: any) => void;
  onInvoiceUpdated?: (invoice: any) => void;
}

export function ResidentCard({
  senior,
  invoices,
  onInvoiceCreated,
  onInvoiceUpdated,
}: ResidentCardProps) {
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

  const monthlyRate = senior?.monthly_rate ?? 0;
  const seniorName = senior?.name ?? "Unknown";
  const roomNumber = senior?.room_number ?? "N/A";

  const residentInvoices = invoices.filter(
    (inv) => inv.senior_id === senior?.id && inv.status?.toUpperCase() !== InvoiceStatus.VOID,
  );

  const totalInvoiced = residentInvoices
    .filter((inv) => inv.status?.toUpperCase() === InvoiceStatus.DUE)
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = residentInvoices
    .filter((inv) => inv.status?.toUpperCase() === InvoiceStatus.PAID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalVoid = residentInvoices
    .filter((inv) => inv.status?.toUpperCase() === InvoiceStatus.VOID)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingBalance = totalInvoiced - (totalPaid - totalVoid);

  return (
    <>
      <Card className="p-5 border border-[#E5E7EB] rounded-xl shadow-lg w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={senior?.profile_image}
              name={seniorName}
              size={40}
              variant="bordered"
            />
            <div>
              <p className=" flex flex-col">
                <span className="text-[16px] font-semibold w-[140px] truncate">{seniorName}</span>
                <span className="text-[14px]">
                  {roomNumber ? `Room ${roomNumber}` : ""}
                </span>
              </p>
            </div>
          </div>
          <div
            className="px-3 py-1.5 text-sm cursor-pointer flex items-center gap-1.5 rounded-lg bg-[#1E293B] text-white"
            onClick={() => setCreateInvoiceOpen(true)}
          >
            <FileText className="h-4 w-4" />
            New Invoice
          </div>
        </div>

        {/* Stats */}
        <div className="pt-4 border-t border-[#F3F4F6] grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
            <p className="text-[11px] uppercase font-medium">Monthly Rate</p>
            <p className="mt-1 text-base font-bold text-[#111827]">
              ${monthlyRate.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-2 bg-[#F0FDF4] rounded-lg">
            <p className="text-[11px] uppercase font-medium">Total Paid</p>
            <p className="mt-1 text-base font-bold text-[#16A34A]">
              ${totalPaid.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-2 bg-[#FEF2F2] rounded-lg">
            <p className="text-[11px] uppercase font-medium">Outstanding</p>
            <p className="mt-1 text-base font-bold text-[#DC2626]">
              ${outstandingBalance.toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      <AddInvoiceModal
        isOpen={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        selectedResident={{ id: senior?.id, name: seniorName }}
      />
    </>
  );
}
