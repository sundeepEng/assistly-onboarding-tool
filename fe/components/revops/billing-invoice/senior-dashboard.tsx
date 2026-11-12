import { useMemo, useState } from "react";
import { Card } from "../../../commonComponents/card";
import Button from "../../../commonComponents/button";
import Loader from "../../../commonComponents/loader";
import useGetAll from "../../../services/getAll";
import { getUserIdFromToken } from "../../../utils/auth";
import { BillingStats } from "./billing-stats";
import {
  DollarSign,
  CreditCard,
  Clock,
  FileText,
} from "lucide-react";
import { getHomeIdFromToken } from "../../../utils/auth";
import { invoicePath } from "../../../utils/constants";
import { format } from "date-fns";
import { formatBillingPeriodMonth } from "../../../utils/billingPeriodUtils";
import { InvoiceStatus } from "../../../utils/constants";
import SeniorInvoicePaymentModal from "./senior-invoice-payment-modal";

interface SeniorDashboardProps {
  userName?: string;
  roomNumber?: string;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  billingPeriod: string;
  dueDate: string;
  amount: number;
  status: string;
  description: string;
  createdAt: string;
  createdByUserId: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

interface ActivityItem {
  id: string;
  type: "payment" | "invoice" | "schedule";
  title: string;
  date: string;
}

export default function SeniorDashboard({
  userName = "Senior",
  roomNumber,
}: SeniorDashboardProps) {
  const userId = getUserIdFromToken();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const { data: invoicesData } = useGetAll({
    key: "invoices",
    params: { home_id: getHomeIdFromToken() },
    path: invoicePath
  });

  // Filter and process invoices for the current senior
  const { myInvoices, stats, upcomingPayments, recentActivity } = useMemo(() => {
    const rawInvoices = invoicesData?.invoices || invoicesData || [];
    if (!Array.isArray(rawInvoices)) {
      return {
        myInvoices: [],
        stats: { outstandingBalance: 0, totalPaidYTD: 0, upcomingSessions: 0, openRequests: 0 },
        upcomingPayments: [],
        recentActivity: [],
      };
    }

    const filtered: InvoiceItem[] = rawInvoices
      .filter((inv: any) => inv.user_id === userId)
      .map((inv: any) => {
        let displayStatus = inv.status || InvoiceStatus.DRAFT;

        // Check for pending approval payments (same logic as regular invoices)
        if (inv.status === InvoiceStatus.DUE && inv.payments && Array.isArray(inv.payments)) {
          const latestPayment = inv.payments
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          if (latestPayment && latestPayment.status === InvoiceStatus.PENDING_APPROVAL) {
            displayStatus = InvoiceStatus.PENDING_APPROVAL;
          }
        }

        return {
          id: inv.id || inv.invoice_id,
          invoiceNumber: inv.invoice_id || "#INV",
          billingPeriod: inv.billing_period || "",
          dueDate: inv.due_date || "",
          amount: Number(inv.total_amount) || 0,
          status: displayStatus,
          description: inv.notes || "",
          createdAt: inv.created_at || new Date().toISOString(),
          createdByUserId: inv.created_by_user_id || "",
          lineItems: inv.line_items || [],
        };
      });

    // Calculate stats (active invoices + total paid)
    const activeInvoices = filtered.filter((inv) => inv.status !== InvoiceStatus.VOID && inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.PENDING_APPROVAL);
    const paidInvoices = filtered.filter((inv) => inv.status === InvoiceStatus.PAID);
    const totalInvoiced = [...activeInvoices, ...paidInvoices].reduce((sum, inv) => sum + inv.amount, 0);

    const currentYear = new Date().getFullYear();
    const totalPaidYTD = paidInvoices
      .filter((inv) => {
        const invYear = inv.dueDate ? new Date(inv.dueDate).getFullYear() : 0;
        return invYear === currentYear;
      })
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Calculate overdue amount (only due invoices)
    const overdueAmount = activeInvoices
      .filter((inv) => inv.status === InvoiceStatus.DUE)
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Get upcoming payments (unpaid invoices sorted by due date)
    const upcoming = filtered
      .filter((inv) => inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.VOID && inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.PENDING_APPROVAL)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);

    // Generate recent activity from invoices
    const activity: ActivityItem[] = filtered
      .slice(0, 5)
      .map((inv) => {
        const monthName = inv.billingPeriod ? formatBillingPeriodMonth(inv.billingPeriod) : "Invoice";

        if (inv.status === InvoiceStatus.PAID) {
          return {
            id: inv.id,
            type: "payment" as const,
            title: `${monthName} invoice paid`,
            date: inv.dueDate,
          };
        }
        if (inv.status === InvoiceStatus.VOID) {
          return {
            id: inv.id,
            type: "invoice" as const,
            title: `${monthName} invoice voided`,
            date: inv.dueDate,
          };
        }
        return {
          id: inv.id,
          type: "invoice" as const,
          title: `${monthName} invoice generated`,
          date: inv.dueDate,
        };
      });

    return {
      myInvoices: filtered,
      stats: {
        totalInvoiced: totalInvoiced,
        totalPaid: totalPaidYTD,
        overdueAmount,
        invoiceCount: activeInvoices.length,
      },
      upcomingPayments: upcoming,
      recentActivity: activity,
    };
  }, [invoicesData, userId]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case "invoice":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "schedule":
        return <Clock className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityBadgeClass = (type: string) => {
    switch (type) {
      case "payment":
        return "bg-green-100 text-green-700";
      case "invoice":
        return "bg-blue-100 text-blue-700";
      case "schedule":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const handlePayNow = (invoice: InvoiceItem) => {
    setSelectedInvoice(invoice);
  };

  const handleClosePaymentModal = () => {
    setSelectedInvoice(null);
  };

  const handlePaymentProcessed = () => {
    setSelectedInvoice(null);
  };


  return (
    <div className="font-poppins">
      {/* Welcome Section */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#111827]">
          Dashboard
        </h1>
        <p className="mt-1 text-[#6B7280]">
          Here&apos;s an overview of your account
        </p>
      </div>

      {/* Stats Cards */}
      <BillingStats
        totalInvoiced={stats.totalInvoiced}
        totalPaid={stats.totalPaid}
        overdueAmount={stats.overdueAmount}
        invoiceCount={stats.invoiceCount}
      />

      {/* Two Column Layout: Upcoming Payments & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        {/* Upcoming Payments */}
        <Card className="p-5 bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-[#111827]" />
            <h3 className="text-lg font-semibold text-[#111827]">
              Upcoming Payments
            </h3>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">Invoices due soon</p>

          {upcomingPayments.length === 0 ? (
            <div className="text-center py-8 text-[#6B7280]">
              No upcoming payments
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingPayments.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
                >
                  <div>
                    <p className="font-medium text-[#111827]">
                      {invoice.billingPeriod
                        ? `${formatBillingPeriodMonth(invoice.billingPeriod)} Care Fee`
                        : "Care Fee"}
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      Due: {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[#111827]">
                      ${invoice.amount.toLocaleString()}
                    </span>
                    {invoice.status !== InvoiceStatus.PENDING_APPROVAL && (
                      <Button
                        name="Pay Now"
                        classname="!h-8 !px-4 bg-[#10B981]"
                        titleClass="!text-sm !text-white"
                        buttonClick={() => handlePayNow(invoice)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-5 bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-[#111827]" />
            <h3 className="text-lg font-semibold text-[#111827]">
              Recent Activity
            </h3>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">Your latest updates</p>

          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-[#6B7280]">
              No recent activity
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-lg "
                >
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getActivityBadgeClass(activity.type)}`}
                  >
                    {activity.type}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#111827]">
                      {activity.title}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {formatDate(activity.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Modal */}
      <SeniorInvoicePaymentModal
        invoiceToPay={selectedInvoice}
        onClose={handleClosePaymentModal}
        onPaymentProcessed={handlePaymentProcessed}
      />
    </div>
  );
}
