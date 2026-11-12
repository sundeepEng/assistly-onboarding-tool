import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import useGetAll from "../../services/getAll";
import Layout from "../../components/layout";
import { getInitialRoute, hasAccess } from "../../utils/roleAccess";
import { getUserIdFromToken, getUserRoleFromToken, getHomeIdFromToken } from "../../utils/auth";
import { Role } from "../../utils/roles";
import { invoicePath } from "../../utils/constants";
import Button from "../../commonComponents/button";
import InputFieldComponent from "../../commonComponents/input-field-component";
import Invoices from "../../components/revops/billing-invoice/invoices";
import Residents from "../../components/revops/billing-invoice/residents";
import PaymentHistory from "../../components/revops/billing-invoice/payment-history";
import { BillingStats } from "../../components/revops/billing-invoice/billing-stats";
import Tabs from "../../commonComponents/tabs";
import AddInvoiceModal from "../../components/revops/billing-invoice/add-invoice";
import SeniorInvoices from "../../components/revops/billing-invoice/senior-invoices";
import { InvoiceStatus } from "../../utils/constants";
import PlusIcon from "../../public/icons/plus-icon";



export default function BillingInvoice() {
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [activeBillingTab, setActiveBillingTab] = useState("Invoices");
  const [isAddInvoiceModalOpen, setIsAddInvoiceModalOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [billingMonthMax, setBillingMonthMax] = useState("");

  // Fetch invoices data
  const homeId = getHomeIdFromToken();
  const { data: invoicesData } = useGetAll({
    key: "invoices",
    params: { home_id: homeId },
    path: invoicePath
  });

  // Calculate billing stats based on filterMonth
  const billingStats = useMemo(() => {
    const rawInvoices = invoicesData?.invoices || invoicesData || [];
    if (!Array.isArray(rawInvoices) || rawInvoices.length === 0 || !filterMonth) {
      return { totalInvoiced: 0, totalPaid: 0, overdueAmount: 0, invoiceCount: 0 };
    }

    const filteredInvoices = rawInvoices.filter(
      (inv: any) => inv.billing_period === filterMonth
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalInvoiced = 0;
    let totalPaid = 0;
    let overdueAmount = 0;

    filteredInvoices.forEach((inv: any) => {
      const amount = Number(inv.total_amount) || 0;
      const status = inv.status?.toUpperCase();

      // Total invoiced = DRAFT + DUE
      if (status === InvoiceStatus.DRAFT || status === InvoiceStatus.DUE) {
        totalInvoiced += amount;
      }

      // Total paid = PAID
      if (status === InvoiceStatus.PAID) {
        totalPaid += amount;
      }

      // Overdue amount = DUE
      if (status === InvoiceStatus.DUE) {
        overdueAmount += amount;
      }
    });

    return {
      totalInvoiced,
      totalPaid,
      overdueAmount,
      invoiceCount: filteredInvoices.filter((inv: any) => inv.status?.toUpperCase() === InvoiceStatus.DUE).length,
    };
  }, [invoicesData, filterMonth]);

  // Initialize client-side only values after mount
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setFilterMonth(currentMonth);
    setBillingMonthMax(currentMonth);
    setIsMounted(true);
  }, []);

  const userId = getUserIdFromToken();
  const role = getUserRoleFromToken() as Role;

  const handleCreateInvoice = () => {
    setIsAddInvoiceModalOpen(true);
  };


  useEffect(() => {
    if (isMounted && !hasAccess(role as Role, "REVOPS_BILLING_INVOICE", "EDIT")) {
      const route = getInitialRoute(role, userId);
      route && router.push(route);
    }
  }, [role, router, userId, isMounted]);

  // RBAC checks - only evaluate after mount to prevent hydration mismatch
  const canViewAdminBilling = isMounted && hasAccess(role as Role, "REVOPS_PCHO_BILLING_INVOICE", "EDIT");
  const canViewSeniorBilling = isMounted && hasAccess(role as Role, "REVOPS_SENIOR_BILLING_INVOICE", "EDIT");

  return (
    <Layout>
      {/* Admin Billing View */}
      {canViewAdminBilling && (
        <div>
          <div className="flex items-center justify-between mb-[10px]">
            <div className="flex flex-col gap-3">
              <div className="text-[32px] font-bold font-jakarta">
                Billing & Invoices
              </div>
              <div className="text-[18px] ">
                Manage resident billing and track payments
              </div>
            </div>
            <div className="flex justify-end gap-5">
              <InputFieldComponent
                name="filterMonth"
                type="month"
                label=""
                value={filterMonth}
                max={billingMonthMax}
                onChange={(e) => setFilterMonth(e.target.value)}
                titleClass="hidden"
                className="w-[150px] h-[40px]"
              />
              <Button
                name="Create Invoice"
                classname="!w-[200px]"
                buttonClick={handleCreateInvoice}
                icon={<PlusIcon color="white" />}
                iconStart={true}
              />
            </div>
          </div>

          {/* stats */}
          <BillingStats
            totalInvoiced={billingStats.totalInvoiced}
            totalPaid={billingStats.totalPaid}
            overdueAmount={billingStats.overdueAmount}
            invoiceCount={billingStats.invoiceCount}
          />

          {/* billing tabs */}
          <div className="mt-6">
            <Tabs
              key={filterMonth}
              tabs={[
                {
                  label: "Invoices",
                  content: <Invoices filterMonth={filterMonth} />,
                },
                {
                  label: "Residents",
                  content: <Residents filterMonth={filterMonth} />,
                },
                {
                  label: "Payment History",
                  content: <PaymentHistory filterMonth={filterMonth} />,
                },
              ]}
              activeTab={activeBillingTab}
              onTabChange={setActiveBillingTab}
              containerClassName="rounded-t-[10px] pt-[5px]"
              activeTabClassName="text-[black] text-2xl"
            />
          </div>
        </div>
      )}

      {/* Senior Billing View */}
      {canViewSeniorBilling && (
        <SeniorInvoices />
      )}



      {/* Add Invoice Modal */}
      <AddInvoiceModal
        isOpen={isAddInvoiceModalOpen}
        onClose={() => setIsAddInvoiceModalOpen(false)}
      />
    </Layout>
  );
}
