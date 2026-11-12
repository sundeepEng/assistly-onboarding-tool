import { DollarSign, FileText, AlertCircle, CheckCircle } from "lucide-react";
import StatsCard from "../../../commonComponents/stats-card";


interface BillingStatsProps {
  totalInvoiced: number;
  totalPaid: number;
  overdueAmount: number;
  invoiceCount: number;
}

export function BillingStats({
  totalInvoiced,
  totalPaid,
  overdueAmount,
  invoiceCount,
}: BillingStatsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Invoiced"
        value={`$${totalInvoiced.toLocaleString()}`}
        icon={<DollarSign className="h-5 w-5" />}
        iconColor="text-primary"
        iconBgColor="bg-primary/10"
        valueColor=""
      />

      <StatsCard
        title="Total Paid"
        value={`$${totalPaid.toLocaleString()}`}
        icon={<CheckCircle className="h-5 w-5" />}
        iconColor="text-green-600"
        iconBgColor="bg-green-100"
        valueColor="text-green-600"
      />

      <StatsCard
        title="Due Amount"
        value={`$${overdueAmount.toLocaleString()}`}
        icon={<AlertCircle className="h-5 w-5" />}
        iconColor="text-red-600"
        iconBgColor="bg-red-100"
        valueColor="text-red-600"
      />

      <StatsCard
        title="Active Invoices"
        value={invoiceCount}
        icon={<FileText className="h-5 w-5" />}
        iconColor="text-muted-foreground"
        iconBgColor="bg-gray/20"
        valueColor=""
      />
    </div>
  );
}
