import BaseTable from "../../../commonComponents/base-table";
import { Download, Eye, Edit, Trash2, CheckCircle, DollarSign, BadgeDollarSign } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import PopoverComponent from "../../../commonComponents/popover-component";
import MenuIcon from "../../../public/icons/menu-icon";
import ViewInvoiceModal from "./view-invoice";
import useGetAll from "../../../services/getAll";
import useUpdate from "../../../services/update";
import useCreate from "../../../services/create";
import useGetById from "../../../services/getById";
import Loader from "../../../commonComponents/loader";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import { GetUsersPath, InvoiceStatus, userRoles, invoicePath, homePath, revopsPaymentPath } from "../../../utils/constants";
import { downloadInvoiceAsText } from "./download-invoice";
import AddInvoiceModal from "./add-invoice";
import PchoMarkAsPaidModal from "./pcho-mark-as-paid-modal";
import Button from "../../../commonComponents/button";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { getYYYYMMDDString, omit } from "../../../utils/dateUtils";
import { formatBillingPeriodMonth, InvoiceItemCategory } from "../../../utils/billingPeriodUtils";

interface InvoiceItem {
  item_category: InvoiceItemCategory;
  description: string;
  amount: number;
  invoice_item_id?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  billingPeriod: string;
  resident: string;
  userId: string;
  createdByUserId: string;
  dueDate: string;
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  roomNumber: string;
  rawItems: InvoiceItem[];
  parentInvoiceId?: number | null;
}

interface InvoicesProps {
  filterMonth?: string;
}


export default function Invoices({ filterMonth }: InvoicesProps) {
  const homeId = getHomeIdFromToken();
  const dispatch = useAppDispatch();
  const { data: invoicesData, isLoading } = useGetAll({
    key: "invoices",
    params: { home_id: homeId, billing_period: filterMonth },
    path: invoicePath
  });
  const { mutate: updateInvoice } = useUpdate();
  const { mutate: createInvoice } = useCreate();
  const { mutate: updatePayment } = useUpdate();

  // Fetch seniors to get names
  const { data: seniorsData } = useGetAll({
    key: userRoles.SENIOR,
    params: {
      userType: userRoles.SENIOR,
      homeId: homeId || "",
    },
    path: GetUsersPath,
  });

  const pchoUserId = getUserIdFromToken();

  // Fetch home data to get home information
  const { data: homeData } = useGetById({
    key: "home",
    payload: {
      id: homeId,
      path: homePath,
      enabled: !!homeId
    },
  });

  // Fetch PCHO data to get phone number
  const { data: pchoData } = useGetAll({
    key: "pcho-users",
    params: {
      userType: userRoles.PCHO,
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
        const id = user.userId || user.user_id || user.id || user._id;
        const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
        if (id) map[id] = name || "Unknown";
      });
    }
    return map;
  }, [seniorsData]);

  // Map API response to Invoice interface and filter by month
  const invoices: Invoice[] = useMemo(() => {
    const rawInvoices = invoicesData?.invoices || invoicesData || [];

    if (!Array.isArray(rawInvoices) || rawInvoices.length === 0) return [];

    // Map API data to component interface
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mapped = rawInvoices.map((inv: any) => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const apiStatus = inv.status?.toUpperCase() || InvoiceStatus.DRAFT;

      // Show OVERDUE if due date has passed and status is DUE
      let displayStatus = apiStatus;
      if (dueDate && apiStatus === InvoiceStatus.DUE) {
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          displayStatus = InvoiceStatus.OVERDUE;
        }
      }

      // Check for pending approval payments
      if (apiStatus === InvoiceStatus.DUE && inv.payments && Array.isArray(inv.payments)) {
        const latestPayment = inv.payments
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (latestPayment && latestPayment.status === InvoiceStatus.PENDING_APPROVAL) {
          displayStatus = InvoiceStatus.PENDING_APPROVAL;
        }
      }

      return {
        id: inv.id || inv.invoice_id,
        invoiceNumber: inv.invoice_id,
        type: inv.parent_invoice_id ? "Adjusted" : "Primary",
        billingPeriod: inv.billing_period,
        resident: userNameMap[inv.user_id],
        userId: inv.user_id,
        createdByUserId: inv.created_by_user_id,
        dueDate: inv.due_date,
        amount: Number(inv.total_amount),
        status: displayStatus,
        createdAt: inv.created_at,
        description: inv.notes,
        lineItems: (inv.items || []).map((item: any) => ({
          id: item.invoice_item_id,
          description: item.description,
          quantity: 1,
          unitPrice: Number(item.amount) || 0,
          total: Number(item.amount) || 0,
        })),
        roomNumber: inv.room_number,
        rawItems: (inv.items || []).map((item: any) => ({
          invoice_item_id: item.invoice_item_id,
          item_category: item.item_category,
          description: item.description,
          amount: Number(item.amount) || 0,
        })),
        parentInvoiceId: inv.parent_invoice_id,
      };
    });

    // Filter out paid invoices (API already handles billing period filtering)
    let filtered = mapped.filter((inv: Invoice) => inv.status !== InvoiceStatus.PAID);

    return filtered;
  }, [invoicesData, filterMonth, userNameMap]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentConfirmModalOpen, setIsPaymentConfirmModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editInvoiceData, setEditInvoiceData] = useState<{
    id: string;
    invoice_id: string;
    user_id: string;
    billing_period: string;
    due_date: string;
    notes: string;
    items: InvoiceItem[];
  } | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustInvoiceData, setAdjustInvoiceData] = useState<{
    id: string;
    invoice_id: string;
    user_id: string;
    billing_period: string;
    due_date: string;
    notes: string;
    items: InvoiceItem[];
    parent_invoice_id: number;
    originalItems: InvoiceItem[]; // Keep original items with invoice_item_id for void
    originalAmount: number;
  } | null>(null);
  // Ref to capture adjustInvoiceData for the void callback
  const adjustInvoiceDataRef = useRef(adjustInvoiceData);
  adjustInvoiceDataRef.current = adjustInvoiceData;

  const [markAsPaidInvoice, setMarkAsPaidInvoice] = useState<Invoice | null>(null);

  const handleMarkAsPaid = (invoice: Invoice) => {
    setMarkAsPaidInvoice(invoice);
    setOpenMenuId(null);
  };


  const handleDownload = (invoice: Invoice) => {
    const home = (homeData as any)?.home || homeData || {};
    const address = home.homeAddress || {};
    const fullAddress = address.street && address.city && address.state && address.zipCode
      ? `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`
      : home.address || "";

    // Get PCHO phone number
    const pchoList = (pchoData as any)?.users || pchoData || [];
    const firstPCHO = Array.isArray(pchoList) && pchoList.length > 0 ? pchoList[0] : {};
    const pchoPhone = firstPCHO.mobile || "";

    downloadInvoiceAsText({
      invoiceNumber: invoice.invoiceNumber,
      resident: invoice.resident,
      type: invoice.type,
      billingPeriod: invoice.billingPeriod,
      dueDate: invoice.dueDate,
      amount: invoice.amount,
      description: invoice.description,
      status: invoice.status,
      createdAt: invoice.createdAt,
      lineItems: invoice.lineItems,
      roomNumber: invoice.roomNumber,
      homeName: home.homeName || home.name,
      homeAddress: fullAddress,
      homePhone: pchoPhone,
    });
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditInvoiceData({
      id: invoice.id,
      invoice_id: invoice.invoiceNumber,
      user_id: invoice.userId,
      billing_period: invoice.billingPeriod,
      due_date: invoice.dueDate,
      notes: invoice.description || "",
      items: invoice.rawItems,
    });
    setIsEditModalOpen(true);
    setOpenMenuId(null);
  };

  // Handle adjust invoice - creates new invoice with parent_id reference
  const handleAdjustInvoice = (invoice: Invoice) => {
    // If invoice already has a parent, use parent's id; otherwise use current invoice's id
    const parentId = invoice.parentInvoiceId || Number(invoice.id);

    setAdjustInvoiceData({
      id: invoice.id,
      invoice_id: invoice.invoiceNumber,
      user_id: invoice.userId,
      billing_period: invoice.billingPeriod,
      due_date: invoice.dueDate,
      notes: invoice.description || "",
      items: invoice.rawItems.map(item => {
        // Remove invoice_item_id so new items are created
        const { invoice_item_id, ...rest } = item;
        return rest as InvoiceItem;
      }),
      parent_invoice_id: parentId,
      originalItems: invoice.rawItems, // Keep original for void call
      originalAmount: invoice.amount,
    });
    setIsAdjustModalOpen(true);
    setOpenMenuId(null);
  };

  // Handles both create and void in one flow - called by modal with form payload
  const handleAdjustSubmit = (createPayload: any) => {
    const data = adjustInvoiceDataRef.current;
    if (!data) return;

    // Check if payload is the same as original data
    const originalTotal = data.originalItems.reduce((sum: number, item: InvoiceItem) => sum + item.amount, 0);
    const newTotal = createPayload.items.reduce((sum: number, item: InvoiceItem) => sum + item.amount, 0);

    const originalDueDate = getYYYYMMDDString(new Date(data.due_date));
    const newDueDate = getYYYYMMDDString(new Date(createPayload.due_date));

    // Check if items are exactly the same (including descriptions and categories)
    const itemsAreSame =
      data.originalItems.length === createPayload.items.length &&
      data.originalItems.every((originalItem: InvoiceItem, index: number) => {
        const newItem = createPayload.items[index];
        return originalItem.description === newItem.description &&
          originalItem.item_category === newItem.item_category &&
          originalItem.amount === newItem.amount;
      });

    if (itemsAreSame &&
      (data.notes || "") === (createPayload.notes || "") &&
      originalDueDate === newDueDate) {
      setIsAdjustModalOpen(false);
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("No changes made. Please make changes before adjusting the invoice."));
      return;
    }


    // Step 1: Create the adjusted invoice
    createInvoice({
      userData: createPayload,
      path: invoicePath
    }, {
      onSuccess: () => {
        // Step 2: Void the original invoice
        const voidPayload = {
          id: data.id,
          invoice_id: data.invoice_id,
          home_id: homeId,
          user_id: data.user_id,
          created_by_user_id: pchoUserId,
          billing_period: data.billing_period,
          due_date: data.due_date?.split("T")[0] || data.due_date,
          total_amount: data.originalAmount,
          notes: data.notes || "",
          items: data.originalItems.map(item => ({ ...item, invoice_id: data.id })),
          status: InvoiceStatus.VOID,
        };

        updateInvoice({
          data: voidPayload,
          path: invoicePath
        }, {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Adjusted and voided previous invoice successfully!"));
            setIsAdjustModalOpen(false);
            setAdjustInvoiceData(null);
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                error?.response?.data?.error || "Adjustment created but failed to void original invoice."
              )
            );
            setIsAdjustModalOpen(false);
            setAdjustInvoiceData(null);
          },
        });
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            error?.response?.data?.error || "Failed to create adjusted invoice."
          )
        );
      },
    });
  };

  const handleVoidInvoice = (invoice: Invoice) => {
    const payload = {
      id: invoice.id,
      invoice_id: invoice.invoiceNumber,
      home_id: homeId,
      user_id: invoice.userId,
      created_by_user_id: pchoUserId,
      billing_period: invoice.billingPeriod,
      due_date: invoice.dueDate?.split("T")[0] || invoice.dueDate,
      total_amount: invoice.amount,
      notes: invoice.description || "",
      items: invoice.rawItems.map(item => ({ ...item, invoice_id: invoice.id })),
      status: InvoiceStatus.VOID,
    };

    updateInvoice({
      data: payload,
      path: invoicePath
    }, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Invoice voided successfully!"));
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            error?.response?.data?.error || "Failed to void invoice."
          )
        );
      },
    });
    setOpenMenuId(null);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const handleFinalizeInvoice = (invoice: Invoice) => {
    const payload = {
      id: invoice.id,
      invoice_id: invoice.invoiceNumber,
      home_id: homeId,
      user_id: invoice.userId,
      created_by_user_id: pchoUserId,
      billing_period: invoice.billingPeriod,
      due_date: invoice.dueDate?.split("T")[0] || invoice.dueDate,
      total_amount: invoice.amount,
      notes: invoice.description || "",
      items: invoice.rawItems.map(item => ({ ...item, invoice_id: invoice.id })),
      status: InvoiceStatus.DUE,
    };

    updateInvoice({
      data: payload,
      path: invoicePath
    }, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Invoice finalized successfully!"));
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            error?.response?.data?.error || "Failed to finalize invoice."
          )
        );
      },
    });
    setOpenMenuId(null);
  };

  const handleReceivedPayment = (invoice: Invoice) => {
    // Find the original invoice data to get payment details
    const rawInvoices = invoicesData?.invoices || invoicesData || [];
    const originalInvoice = rawInvoices.find((inv: any) => inv.id === invoice.id);

    if (originalInvoice && originalInvoice.payments && Array.isArray(originalInvoice.payments)) {
      const latestPayment = originalInvoice.payments
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (latestPayment && latestPayment.status === InvoiceStatus.PENDING_APPROVAL) {
        setSelectedPayment(latestPayment);
        setSelectedInvoice(invoice);
        setIsPaymentConfirmModalOpen(true);
      }
    }
    setOpenMenuId(null);
  };

  const handleConfirmPayment = () => {
    if (!selectedPayment) return;

    // Update payment status from PENDING_APPROVAL to PAID
    const paymentPayload = {
      ...selectedPayment,
      status: InvoiceStatus.PAID,
    };

    const finalpaymentPayload = omit(paymentPayload, ["created_at", "updated_at", "manual_paid_at"]);

    updatePayment({
      data: finalpaymentPayload,
      path: `${revopsPaymentPath}`
    }, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Payment confirmed successfully!"));
        setIsPaymentConfirmModalOpen(false);
        setSelectedPayment(null);
        setSelectedInvoice(null);
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        handleShowPopoverMessage(
          !Array?.isArray(error?.response?.data?.error)
            ? error?.response?.data?.error
            : "Failed to confirm payment."
        );
      },
    });
  };

  const renderActions = (row: Invoice) => {
    const status = row.status.toUpperCase();
    const isDraft = status === InvoiceStatus.DRAFT;
    const isDue = status === InvoiceStatus.DUE || status === InvoiceStatus.OVERDUE;
    const isVoid = status === InvoiceStatus.VOID;
    const isPendingApproval = status === InvoiceStatus.PENDING_APPROVAL;

    return (
      <div className="flex justify-end gap-2">
        <div
          onClick={() => handleViewInvoice(row)}
          className="p-1 cursor-pointer"
          title="View Invoice"
        >
          <Eye className="h-4 w-4" />
        </div>
        <div
          onClick={() => handleDownload(row)}
          className="p-1 cursor-pointer"
          title="Download Invoice"
        >
          <Download className="h-4 w-4" />
        </div>

        {!isVoid && (
          <div className="relative">
            <PopoverComponent
              isOpen={openMenuId === row.id}
              setIsOpen={(isOpen) => setOpenMenuId(isOpen ? row.id : null)}
              body={
                <div className="w-[180px] pr-2">
                  {(isDraft) && (
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                      onClick={() => handleEditInvoice(row)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Invoice
                    </div>
                  )}

                  {isDraft && (
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                      onClick={() => handleFinalizeInvoice(row)}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Finalize Invoice
                    </div>
                  )}

                  {isDue && (
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                      onClick={() => handleAdjustInvoice(row)}
                    >
                      <Edit className="h-4 w-4" />
                      Adjust Invoice
                    </div>
                  )}

                  {isDue && (
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                      onClick={() => handleMarkAsPaid(row)}
                    >
                      <BadgeDollarSign className="h-4 w-4" />
                      Mark as Paid
                    </div>
                  )}

                  {isPendingApproval && (
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                      onClick={() => handleReceivedPayment(row)}
                    >
                      <DollarSign className="h-4 w-4" />
                      Received Payment
                    </div>
                  )}

                  {(isDraft || isDue) && (
                    <div
                      className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                      onClick={() => handleVoidInvoice(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Void Invoice
                    </div>
                  )}
                </div>
              }
            >
              <MenuIcon />
            </PopoverComponent>
          </div>
        )}
      </div>
    );
  };

  const columns = [
    {
      header: "Invoice #",
      field: "invoiceNumber" as keyof Invoice,
      render: (value: string) => <span className="font-medium">{value || "-"}</span>,
      headerClassName: "pl-[25px] font-medium",
    },
    {
      header: "Type",
      field: "type" as keyof Invoice,
      render: (value: string) => (
        <span className="p-3 text-[16px]">{value || "-"}</span>
      ),
      headerClassName: "pl-[10px]  font-medium",
    },
    {
      header: "Billing Period",
      field: "billingPeriod" as keyof Invoice,
      render: (value: string) => (
        <span className="p-3 text-[16px]">{formatBillingPeriodMonth(value) || "-"}</span>
      ),
      headerClassName: "pl-[10px]  font-medium",
    },
    {
      header: "Resident",
      field: "resident" as keyof Invoice,
      render: (value: string) => (
        <span className="p-3 text-[16px] w-[150px] truncate" title={value}>{value || "Unknown"}</span>
      ),
      headerClassName: "pl-[10px] font-medium",
    },
    {
      header: "Due Date",
      field: "dueDate" as keyof Invoice,
      render: (value: string) => (
        <span className="p-3 text-[16px]">
          {value ? new Date(value).toLocaleDateString() : "-"}
        </span>
      ),
      headerClassName: "pl-[10px]  font-medium",
    },
    {
      header: "Amount",
      field: "amount" as keyof Invoice,
      render: (value: number) => (
        <span className="font-semibold p-3 text-[16px]">
          ${Number(value ?? 0).toFixed(2)}
        </span>
      ),
      headerClassName: "pl-[10px]  font-medium",
    },
    {
      header: "Status",
      field: "status" as keyof Invoice,
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
      headerClassName: "pl-[10px] font-medium",
    },
    {
      header: "Actions",
      field: "id" as keyof Invoice,
      render: (_value: string, row: Invoice) => renderActions(row),
      headerClassName: "flex justify-end",
      minWidth: "150px",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <Loader fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <BaseTable
        columns={columns}
        data={invoices}
        headerStyles="pt-[5px]"
        rowStyles={(row) => ""}
        cellStyles={(field, value, row) =>
          field === "id" ? " justify-end h-full" : "flex h-full"
        }
        tableContainerClass={"rounded-[7px] bg-white"}
        customEmptyMessage="No invoices generated yet for this month."
      />

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
            resident: selectedInvoice.resident,
            type: selectedInvoice.type,
            billingPeriod: selectedInvoice.billingPeriod,
            dueDate: selectedInvoice.dueDate,
            amount: selectedInvoice.amount,
            description: selectedInvoice.description || "",
            status: selectedInvoice.status,
            createdAt: selectedInvoice.createdAt,
            lineItems: selectedInvoice.lineItems,
            roomNumber: selectedInvoice.roomNumber,
          }}
        />
      )}

      {/* Edit Invoice Modal */}
      <AddInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditInvoiceData(null);
        }}
        editInvoice={editInvoiceData}
      />

      {/* Adjust Invoice Modal */}
      <AddInvoiceModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustInvoiceData(null);
        }}
        adjustInvoice={adjustInvoiceData}
        onAdjustSubmit={handleAdjustSubmit}
      />

      {/* PCHO Mark as Paid Modal */}
      <PchoMarkAsPaidModal
        invoice={
          markAsPaidInvoice
            ? {
              id: markAsPaidInvoice.id,
              invoiceNumber: markAsPaidInvoice.invoiceNumber,
              billingPeriod: markAsPaidInvoice.billingPeriod,
              dueDate: markAsPaidInvoice.dueDate,
              amount: markAsPaidInvoice.amount,
              status: markAsPaidInvoice.status,
              userId: markAsPaidInvoice.userId,
              resident: markAsPaidInvoice.resident,
              description: markAsPaidInvoice.description,
              rawItems: markAsPaidInvoice.rawItems,
            }
            : null
        }
        onClose={() => setMarkAsPaidInvoice(null)}
      />

      {/* Payment Confirmation Modal */}
      {selectedPayment && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isPaymentConfirmModalOpen ? '' : 'hidden'}`}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Payment Received</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice:</span>
                <span className="font-medium">{selectedInvoice?.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">${(selectedPayment.amount_cents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">{selectedPayment.manual_method || 'Manual'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid Date:</span>
                <span className="font-medium">
                  {selectedPayment.manual_paid_at ? new Date(selectedPayment.manual_paid_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reference:</span>
                <span className="font-medium">{selectedPayment.manual_reference || 'N/A'}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                name="Cancel"
                type="button"
                buttonClick={() => {
                  setIsPaymentConfirmModalOpen(false);
                  setSelectedPayment(null);
                  setSelectedInvoice(null);
                }}
                classname="bg-gray-200 text-gray-800 hover:bg-gray-300"
              />
              <Button
                name="Confirm Received"
                type="button"
                buttonClick={handleConfirmPayment}
                classname="bg-green-600 text-white hover:bg-green-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
