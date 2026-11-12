import React from "react";
import CommonModal from "../../../commonComponents/common-modal";
import Button from "../../../commonComponents/button";
import { format } from "date-fns";
import { downloadInvoiceAsText } from "./download-invoice";
import { formatBillingPeriod } from "../../../utils/billingPeriodUtils";
import { InvoiceStatus, userRoles, GetUsersPath, homePath } from "../../../utils/constants";
import useGetAll from "../../../services/getAll";
import useGetById from "../../../services/getById";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  resident: string;
  type: string;
  billingPeriod: string;
  dueDate: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  lineItems: LineItem[];
  roomNumber: string;
  homeName?: string;
  homeAddress?: string;
  homePhone?: string;
}

interface ViewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: InvoiceData;
}

export default function ViewInvoiceModal({
  isOpen,
  onClose,
  invoiceData,
}: ViewInvoiceModalProps) {
  const homeId = getHomeIdFromToken();
  const pchoUserId = getUserIdFromToken();

  // Fetch home data to get home information
  const { data: homeData } = useGetById({
    key: "home",
    payload: {
      id: homeId,
      path: homePath,
    },
  });

  // Fetch PCHO data to get phone number
  const { data: pchoData } = useGetAll({
    key: "pcho-users",
    params: {
      userType: userRoles.PCHO,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const handleDownload = () => {
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
      ...invoiceData,
      homeName: home.homeName || home.name,
      homeAddress: fullAddress,
      homePhone: pchoPhone,
    });
  };
  const handlePrint = () => {
    // Create a printable version of the invoice
    const printContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center; margin-bottom: 30px;">INVOICE #${invoiceData.invoiceNumber}</h1>
        
        <div style="margin-bottom: 20px;">
          <p><strong>Resident:</strong> ${invoiceData.resident}</p>
          <p><strong>Type:</strong> ${invoiceData.type}</p>
          <p><strong>Billing Period:</strong> ${invoiceData.billingPeriod}</p>
          <p><strong>Due Date:</strong> ${format(new Date(invoiceData.dueDate), "MMM dd, yyyy")}</p>
          <p><strong>Status:</strong> <span style="color: ${invoiceData.status === InvoiceStatus.PAID ? "green" :
        invoiceData.status === InvoiceStatus.OVERDUE ? "red" : "orange"
      }">${invoiceData.status.toUpperCase()}</span></p>
          <p><strong>Created:</strong> ${format(new Date(invoiceData.createdAt), "MMM dd, yyyy")}</p>
        </div>

        <h2 style="border-bottom: 2px solid #333; padding-bottom: 10px;">Line Items</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 1px solid #ccc;">
              <th style="text-align: left; padding: 10px;">Description</th>
              <th style="text-align: center; padding: 10px;">Quantity</th>
              <th style="text-align: right; padding: 10px;">Unit Price</th>
              <th style="text-align: right; padding: 10px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceData.lineItems
        .map(
          (item) => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 10px;">${item.description}</td>
                  <td style="text-align: center; padding: 10px;">${item.quantity}</td>
                  <td style="text-align: right; padding: 10px;">$${item.unitPrice.toFixed(2)}</td>
                  <td style="text-align: right; padding: 10px;">$${item.total.toFixed(2)}</td>
                </tr>
              `
        )
        .join("")}
          </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 20px;">
          <p style="font-size: 18px;"><strong>Total: $${invoiceData.amount.toFixed(2)}</strong></p>
        </div>

        ${invoiceData.description ? `
          <div style="margin-top: 30px;">
            <h3>Notes</h3>
            <p>${invoiceData.description}</p>
          </div>
        ` : ""}
        
        ${invoiceData.homeName || invoiceData.homeAddress || invoiceData.homePhone ? `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center;">
            <p style="font-size: 14px; color: #666;">
              ${invoiceData.homeName ? `<strong>${invoiceData.homeName}</strong><br>` : ""}
              ${invoiceData.homeAddress ? `${invoiceData.homeAddress}<br>` : ""}
              ${invoiceData.homePhone ? `Phone: ${invoiceData.homePhone}` : ""}
            </p>
          </div>
        ` : ""}
      </div>
    `;

    // Open print dialog
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice #${invoiceData.invoiceNumber}</title>
            <style>
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case InvoiceStatus.DRAFT:
        return "bg-amber-100 text-amber-700";
      case InvoiceStatus.DUE:
        return "bg-blue-100 text-blue-700";
      case InvoiceStatus.OVERDUE:
        return "bg-red-100 text-red-700";
      case InvoiceStatus.VOID:
        return "bg-[#F5F5F5]";
      case InvoiceStatus.PAID:
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <CommonModal
      modalOpen={isOpen}
      setModalOpen={onClose}
      crossCTA
      className="!w-[650px]"
    >
      <div className="">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="p-0">
            <h3 className="flex flex-col">
              Invoice #{invoiceData.invoiceNumber}
              <span className="font-medium">{invoiceData.type} - {formatBillingPeriod(invoiceData.billingPeriod)}</span>

            </h3>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="bg-gray-50 rounded-lg">

          <div>
            <p className="font-semibold">Bill To:</p>
            <p className="font-medium">{invoiceData.resident}</p>
          </div>
          {/* <div>
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-medium">{invoiceData.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Billing Period</p>
              <p className="font-medium">{invoiceData.billingPeriod}</p>
                  </div> */}
          <div className="grid grid-cols-3">
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-medium">{format(new Date(invoiceData.dueDate), "MMM dd, yyyy")}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="font-medium">{format(new Date(invoiceData.createdAt), "MMM dd, yyyy")}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-2 py-1 rounded-full font-medium text-sm ${getStatusColor(invoiceData.status)}`}>
                {invoiceData.status.toUpperCase()}
              </span>
            </div>

          </div>
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Invoice Items</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Description</th>
                  <th className="text-center p-3 font-medium text-gray-700">Quantity</th>
                  <th className="text-right p-3 font-medium text-gray-700">Unit Price</th>
                  <th className="text-right p-3 font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.lineItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">{item.description}</td>
                    <td className="text-center p-3">{item.quantity}</td>
                    <td className="text-right p-3">${item.unitPrice.toFixed(2)}</td>
                    <td className="text-right p-3">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="p-3 text-right font-semibold">
                    Total:
                  </td>
                  <td className="p-3 text-right font-bold text-lg">
                    ${invoiceData.amount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        {invoiceData.description && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Notes</h3>
            <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
              {invoiceData.description}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            name="Download"
            classname="bg-gray-600 text-white px-6 py-2"
            buttonClick={handleDownload}
          />
          <Button
            name="Print"
            classname="bg-primary text-white px-6 py-2"
            buttonClick={handlePrint}
          />
        </div>
      </div>
    </CommonModal>
  );
}