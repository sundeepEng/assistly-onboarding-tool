import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { getUserIdFromToken, getUserRoleFromToken, getHomeIdFromToken } from "../../../utils/auth";
import { Role } from "../../../utils/roles";
import { BillingStats } from "./billing-stats";
import BaseTable from "../../../commonComponents/base-table";
import useGetAll from "../../../services/getAll";
import useGetById from "../../../services/getById";
import Loader from "../../../commonComponents/loader";
import { Eye, Download, DollarSign, CreditCard } from "lucide-react";
import ViewInvoiceModal from "./view-invoice";
import SeniorInvoicePaymentModal from "./senior-invoice-payment-modal";
import Button from "../../../commonComponents/button";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import SelectComponent from "../../../commonComponents/select-component";
import { downloadInvoiceAsText } from "./download-invoice";
import { InvoiceStatus, invoicePath, UserPath } from "../../../utils/constants";
import { formatBillingPeriod } from "../../../utils/billingPeriodUtils";

interface SeniorInvoice {
  id: string;
  invoiceNumber: string;
  billingPeriod: string;
  createdByUserId: string;
  dueDate: string;
  amount: number;
  status: string;
  createdAt: string;
  description: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}



export default function SeniorInvoices() {
  const router = useRouter();

  const userId = getUserIdFromToken();
  const role = getUserRoleFromToken() as Role;

  const [filterMonth, setFilterMonth] = useState("");
  const [billingMonthMax, setBillingMonthMax] = useState("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SeniorInvoice | null>(null);
  const [invoiceToPay, setInvoiceToPay] = useState<SeniorInvoice | null>(null);

  const { data: invoicesData, isLoading } = useGetAll({
    key: "invoices",
    params: { home_id: getHomeIdFromToken(), billing_period: filterMonth },
    path: invoicePath
  });

  // Fetch current senior user data to get name
  const { data: userData } = useGetById({
    key: "user",
    payload: {
      id: userId,
      path: UserPath,
      enabled: !!userId,
    },
  });

  const userName = userData?.firstName + " " + userData?.lastName;

  // Initialize date values on client-side only to prevent hydration mismatch
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setFilterMonth(currentMonth);
    setBillingMonthMax(currentMonth);
  }, []);

  // Filter invoices for the current senior user (API already handles billing period filtering)
  const myInvoices: SeniorInvoice[] = useMemo(() => {
    const rawInvoices = invoicesData?.invoices || invoicesData || [];
    if (!Array.isArray(rawInvoices)) return [];

    return rawInvoices
      .filter((inv: any) => inv.user_id === userId)
      .filter((inv: any) => inv.status !== InvoiceStatus.DRAFT)
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
          createdAt: inv.created_at || "",
          description: inv.notes || "",
          createdByUserId: inv.created_by_user_id || "",
          lineItems: (inv.items || []).map((item: any) => ({
            id: item.invoice_item_id,
            description: item.description,
            quantity: 1,
            unitPrice: Number(item.amount) || 0,
            total: Number(item.amount) || 0,
          })),
        };
      });
  }, [invoicesData, userId]);

  const handleViewInvoice = (invoice: SeniorInvoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const handleDownload = (invoice: SeniorInvoice) => {
    downloadInvoiceAsText({
      invoiceNumber: invoice.invoiceNumber,
      resident: userName,
      billingPeriod: invoice.billingPeriod,
      dueDate: invoice.dueDate,
      amount: invoice.amount,
      description: invoice.description,
      status: invoice.status,
      createdAt: invoice.createdAt,
      lineItems: invoice.lineItems,
    });
  };

  const handlePayInvoice = (invoice: SeniorInvoice) => {
    setInvoiceToPay(invoice);
  };

  // Calculate stats (active invoices + total paid)
  const stats = useMemo(() => {
    const activeInvoices = myInvoices.filter((inv) => inv.status !== InvoiceStatus.VOID && inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.PENDING_APPROVAL);
    const paidInvoices = myInvoices.filter((inv) => inv.status === InvoiceStatus.PAID);
    const totalInvoiced = [...activeInvoices, ...paidInvoices].reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const overdueAmount = activeInvoices
      .filter((inv) => inv.status === InvoiceStatus.DUE)
      .reduce((sum, inv) => sum + inv.amount, 0);
    return { totalInvoiced, totalPaid, overdueAmount, invoiceCount: activeInvoices.length };
  }, [myInvoices]);

  const columns = [
    {
      header: "Invoice #",
      field: "invoiceNumber" as const,
      render: (value: string) => <span className="font-medium p-3">{value || "-"}</span>,
      headerClassName: "pl-[25px] font-medium",
    },
    {
      header: "Billing Period",
      field: "billingPeriod" as keyof SeniorInvoice,
      render: (value: string) => <span className="p-3 text-[16px]">{formatBillingPeriod(value) || "-"}</span>,
      headerClassName: "pl-[10px] font-medium w-[180px]",
    },
    {
      header: "Due Date",
      field: "dueDate" as keyof SeniorInvoice,
      render: (value: string) => (
        <span className="p-3 text-[16px]">
          {value ? new Date(value).toLocaleDateString() : "-"}
        </span>
      ),
      headerClassName: "pl-[10px] font-medium w-[120px]",
    },
    {
      header: "Amount",
      field: "amount" as keyof SeniorInvoice,
      render: (value: number) => (
        <span className="font-semibold p-3 text-[16px]">
          ${Number(value ?? 0).toFixed(2)}
        </span>
      ),
      headerClassName: "pl-[10px] font-medium w-[100px]",
    },
    {
      header: "Status",
      field: "status" as keyof SeniorInvoice,
      render: (value: string) => {
        const statusColors: Record<string, string> = {
          DRAFT: "bg-amber-100 text-amber-700",
          DUE: "bg-blue-100 text-blue-700",
          OVERDUE: "bg-red-100 text-red-700",
          VOID: "bg-[#F5F5F5]",
          PAID: "bg-green-100 text-green-700",
          PENDING_APPROVAL: "text-orange-700",
        };
        return (
          <span
            className={`p-1 px-5 w-[120px] text-center font-semibold rounded-full ${statusColors[value?.toUpperCase()] || "bg-gray-100 text-gray-800"}`}
          >
            {value || "-"}
          </span>
        );
      },
      headerClassName: "pl-[10px] font-medium w-[140px]",
    },
    {
      header: "Actions",
      field: "id" as keyof SeniorInvoice,
      render: (_value: string, row: SeniorInvoice) => (
        <div className="flex gap-2 items-center">
          <div
            className="p-1 cursor-pointer hover:bg-gray-100 rounded"
            title="View Invoice"
            onClick={() => handleViewInvoice(row)}
          >
            <Eye className="h-4 w-4" />
          </div>
          <div
            className="p-1 cursor-pointer hover:bg-gray-100 rounded"
            title="Download Invoice"
            onClick={() => handleDownload(row)}
          >
            <Download className="h-4 w-4" />
          </div>
          {row.status !== InvoiceStatus.PAID && row.status !== InvoiceStatus.VOID && row.status !== InvoiceStatus.PENDING_APPROVAL && (
            <Button
              name="Pay"
              type="button"
              buttonClick={() => handlePayInvoice(row)}
              icon={<DollarSign size={16} color="white" />}
              classname="bg-secondarymirage"
              titleClass="!text-[12px]"
              iconStart={true}
            />
          )}
        </div>
      ),
      headerClassName: "flex justify-end",
      minWidth: "200px",
    },
  ];

  useEffect(() => {
    if (!hasAccess(role as Role, "REVOPS_BILLING_INVOICE", "EDIT")) {
      const route = getInitialRoute(role, userId);
      route && router.push(route);
    }
  }, [role, router, userId]);

  return (

    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            My Invoices
          </h1>
          <p className="mt-2 text-muted-foreground">
            View your billing statements and payment history
          </p>
        </div>
        <div className="flex justify-end">
          <InputFieldComponent
            name="filterMonth"
            type="month"
            label=""
            value={filterMonth}
            max={billingMonthMax}
            onChange={(e) => setFilterMonth(e.target.value)}
            titleClass="hidden"
            className="w-[150px]"
          />
        </div>
      </div>

      {/* stats */}
      <BillingStats
        totalInvoiced={stats.totalInvoiced}
        totalPaid={stats.totalPaid}
        overdueAmount={stats.overdueAmount}
        invoiceCount={stats.invoiceCount}
      />

      {/* Invoices Table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Invoice History</h3>
        {isLoading ? (
          <Loader fullScreen={false} />
        ) : (
          <BaseTable
            columns={columns}
            data={myInvoices}
            headerStyles="pt-[5px]"
            rowStyles={() => ""}
            cellStyles={(field, value, row) =>
              field === "id" ? " justify-end h-full" : "flex h-full"
            }
            tableContainerClass="rounded-[7px] bg-white"
          />
        )}
      </div>

      {/* View Invoice Modal */}
      {selectedInvoice && (
        <ViewInvoiceModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedInvoice(null);
          }}
          invoiceData={{
            invoiceNumber: selectedInvoice.invoiceNumber,
            resident: "My Invoice",
            type: "Primary",
            billingPeriod: selectedInvoice.billingPeriod,
            dueDate: selectedInvoice.dueDate,
            amount: selectedInvoice.amount,
            description: selectedInvoice.description,
            status: selectedInvoice.status,
            createdAt: selectedInvoice.createdAt,
            lineItems: selectedInvoice.lineItems,
            roomNumber: "",
          }}
        />
      )}

      {/* Senior Invoice Payment Modal */}
      <SeniorInvoicePaymentModal
        invoiceToPay={invoiceToPay}
        onClose={() => setInvoiceToPay(null)}
        onPaymentProcessed={() => {
          // Handle successful payment if needed
        }}
      />
    </div>
  );
}
