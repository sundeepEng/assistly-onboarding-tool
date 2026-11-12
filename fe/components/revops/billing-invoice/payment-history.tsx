import { useMemo } from "react";
import BaseTable from "../../../commonComponents/base-table";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, InvoiceStatus, userRoles, invoicePath } from "../../../utils/constants";
import { getHomeIdFromToken } from "../../../utils/auth";
import Loader from "../../../commonComponents/loader";
import { formatBillingPeriod } from "../../../utils/billingPeriodUtils";

interface Payment {
  id: string;
  date: string;
  invoice: string;
  resident: string;
  amount: number;
  billingPeriod: string;
  status: string;
}

interface PaymentHistoryProps {
  filterMonth?: string;
}

export default function PaymentHistory({ filterMonth }: PaymentHistoryProps) {
  const homeId = getHomeIdFromToken();
  const { data: invoicesData, isLoading } = useGetAll({
    key: "invoices",
    params: { home_id: homeId, status: InvoiceStatus.PAID, billing_period: filterMonth },
    path: invoicePath
  });


  // Fetch seniors to get names
  const { data: seniorsData } = useGetAll({
    key: userRoles.SENIOR,
    params: {
      userType: userRoles.SENIOR,
      homeId: homeId || "",
    },
    path: GetUsersPath,
  });

  // Create lookup map for user names
  const userNameMap = useMemo(() => {
    const seniorsList = (seniorsData as any)?.users || seniorsData || [];
    const map: Record<string, string> = {};
    if (Array.isArray(seniorsList)) {
      seniorsList.forEach((user: any) => {
        const id = user.userId || user.id || user._id;
        const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
        if (id) map[id] = name || "Unknown";
      });
    }
    return map;
  }, [seniorsData]);

  // Map invoices to payment format (API already filters for PAID status)
  const paidPayments: Payment[] = useMemo(() => {
    const rawInvoices = invoicesData?.invoices || invoicesData || [];
    if (!Array.isArray(rawInvoices)) return [];

    return rawInvoices.map((inv: any) => ({
      id: inv.id || inv.invoice_id,
      date: inv.updated_at || inv.created_at || "",
      invoice: inv.invoice_id || "#INV",
      resident: userNameMap[inv.user_id] || "Unknown",
      amount: Number(inv.total_amount) || 0,
      billingPeriod: inv.billing_period || "",
      status: InvoiceStatus.PAID,
      paymentMethod: inv.payment_method || "Unknown",
    }));
  }, [invoicesData, userNameMap]);


  if (isLoading) {
    return (
      <div className="p-6">
        <Loader fullScreen={false} />
      </div>
    );
  }

  const columns = [
    {
      header: "Date",
      field: "date" as keyof Payment,
      render: (value: string) => (
        <span className="p-3 text-[16px]">
          {new Date(value).toLocaleDateString()}
        </span>
      ),
      headerClassName: "pl-[15px] font-medium",
      minWidth: "200px",
    },
    {
      header: "Invoice",
      field: "invoice" as keyof Payment,
      render: (value: string) => (
        <span className="p-3 text-[16px] font-medium">
          {value}
        </span>
      ),
      headerClassName: "pl-[10px] font-medium",
      minWidth: "200px",
    },
    {
      header: "Resident",
      field: "resident" as keyof Payment,
      render: (value: string) => (
        <span className="p-3 text-[16px] w-[200px] truncate" title={value}>{value}</span>
      ),
      headerClassName: "pl-[10px] font-medium",
      minWidth: "250px",
    },
    {
      header: "Amount",
      field: "amount" as keyof Payment,
      render: (value: number) => (
        <span className="p-3 text-[16px] font-semibold">
          ${value.toFixed(2)}
        </span>
      ),
      headerClassName: "pl-[10px] font-medium",
      minWidth: "200px",
    },
    {
      header: "Billing Period",
      field: "billingPeriod" as keyof Payment,
      render: (value: string) => (
        <span className="p-3 text-[16px]">{formatBillingPeriod(value) || "-"}</span>
      ),
      headerClassName: "pl-[10px] font-medium",
      minWidth: "200px",
    },
    {
      header: "Status",
      field: "status" as keyof Payment,
      render: (value: string) => {
        const statusColors: Record<string, string> = {
          PAID: "bg-green-100 text-green-700",
          COMPLETED: "bg-green-100 text-green-700",
          PENDING: "bg-amber-100 text-amber-700",
          FAILED: "bg-red-100 text-red-700",
        };
        return (
          <span
            className={`p-1 px-5 w-[120px] text-center font-semibold rounded-full ${statusColors[value?.toUpperCase()] || "bg-gray-100 text-gray-800"}`}
          >
            {value}
          </span>
        );
      },
      headerClassName: "pl-[20px] font-medium",
      minWidth: "200px",
    },
  ];

  return (
    <div>
      <div className="p-6">
        <div className="text-lg font-semibold">Payment History</div>
        <div className="text-[14px]">Record of all received payments</div>
      </div>

      <BaseTable
        columns={columns}
        data={paidPayments}
        headerStyles="pt-[5px]"
        rowStyles={() => "h-[60px]"}
        tableContainerClass={"rounded-[7px] bg-white"}
        cellStyles={() => "flex h-full"}
        customEmptyMessage="No payments received yet for this month."
      />
    </div>
  );
}
