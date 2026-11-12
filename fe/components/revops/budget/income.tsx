import React, { useState } from "react";
import { TrendingUp, DollarSign, AlertCircle, Repeat, Receipt, Eye, Edit, Trash2, Download, Square, Plus } from "lucide-react";
import BaseTable from "../../../commonComponents/base-table";
import StatsCard from "../../../commonComponents/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "../../../commonComponents/card";
import PopoverComponent from "../../../commonComponents/popover-component";
import MenuIcon from "../../../public/icons/menu-icon";
import Button from "../../../commonComponents/button";
import Loader from "../../../commonComponents/loader";
import AddBudgetIncome from "./add-budget-income";
import { getHomeIdFromToken } from "../../../utils/auth";
import { budgetPath } from "../../../utils/constants";
import { formatDateRange, formatIsoToDate } from "../../../utils/dateUtils";
import { Budget } from "../../../model/revops/budget-model";
import fetchPreSignedUrl from "../../../services/get-presigned-url";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import useGetAllShifts from "../../../services/hcm-getall-shifts";

interface Income {
    id: string;
    source: string;
    description: string;
    date: string;
    amount: number;
    type: 'recurring' | 'one-time';
    receiptUrl?: string;
}

interface IncomeProps {
    dateRange: { startDate: string; endDate: string };
}

export const Income = ({ dateRange }: IncomeProps) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isAddIncomeModalOpen, setIsAddIncomeModalOpen] = useState(false);
    const [editingIncome, setEditingIncome] = useState<Budget | null>(null);
    const homeId = getHomeIdFromToken();
    const dispatch = useAppDispatch();

    // Format date range using utility function
    const formattedDateRange = React.useMemo(() => {
        const result = formatDateRange(dateRange?.startDate, dateRange?.endDate);
        return result;
    }, [dateRange]);

    const { data: incomeData, isLoading } = useGetAllShifts({
        key: "budget",
        params: {
            home_id: homeId,
            transaction_date: formattedDateRange,
            transaction_type: "income",
            start_date: dateRange?.startDate,
            end_date: dateRange?.endDate,
        },
        path: budgetPath,
    });

    const BillingInvoiceIncome = (incomeData?.income_invoice) / 100;

    // Transform API data to match Income interface
    const income: Income[] = React.useMemo(() => {
        if (!incomeData?.budgets || !Array.isArray(incomeData.budgets)) {
            return [];
        }

        return incomeData.budgets
            .filter((budget: any) => budget.transaction_type === 'income')
            .map((budget: any) => ({
                id: budget.id?.toString() || '',
                source: budget.category_type || '',
                description: budget.description || '',
                date: budget.transaction_date || '',
                amount: (budget.amount_cents || 0) / 100,
                type: budget.entry_mode === 'one_time' ? 'one-time' : 'recurring',
                receiptUrl: budget.receipt_url || undefined
            }));
    }, [incomeData]);

    const addedIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const billingInvoiceAmount = BillingInvoiceIncome || 0;
    const totalIncome = addedIncome + billingInvoiceAmount;

    const billingInvoiceRow: Income = {
        id: 'billing-invoice',
        source: 'Billing Invoice',
        description: 'Billing Invoice Income',
        date: dateRange?.startDate || '',
        amount: billingInvoiceAmount,
        type: 'recurring',
    };

    const tableData = [billingInvoiceRow, ...income];
    const recurringIncome = income.filter(item => item.type === 'recurring').reduce((sum, item) => sum + item.amount, 0);
    const oneTimeIncome = income.filter(item => item.type === 'one-time').reduce((sum, item) => sum + item.amount, 0);

    const handleViewReceipt = async (income: Income) => {
        if (!income.receiptUrl) return;

        try {
            const url = await fetchPreSignedUrl(income.receiptUrl);
            if (url) {
                window.open(url, "_blank");
            }
        } catch (error) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Unable to load receipt. Please try again."));
        }
        setOpenMenuId(null);
    };

    const handleEditIncome = (income: Income) => {
        // Find the original budget data from API to get the full Budget object
        const budgetData = incomeData?.budgets?.find((b: any) => b.id?.toString() === income.id);
        if (budgetData) {
            setEditingIncome(budgetData);
        }
        setIsAddIncomeModalOpen(true);
        setOpenMenuId(null);
    };

    const handleDownloadReceipt = async (income: Income) => {
        if (!income.receiptUrl) return;

        try {
            const url = await fetchPreSignedUrl(income.receiptUrl);
            if (url) {
                // Fetch the file as a blob to avoid cross-origin issues
                const response = await fetch(url);
                const blob = await response.blob();

                // Create a blob URL and trigger download
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;

                // Extract file extension from URL or default to pdf
                const fileExtension = income.receiptUrl.split('.').pop()?.split('?')[0] || 'pdf';
                link.download = `receipt_${income.id}.${fileExtension}`;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up the blob URL
                window.URL.revokeObjectURL(blobUrl);

                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage("Receipt downloaded successfully."));
            }
        } catch (error) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage("Unable to download receipt. Please try again."));
        }
        setOpenMenuId(null);
    };

    // const handleDeleteIncome = (income: Income) => {
    //     // console.log('Delete income:', income.id);
    //     setOpenMenuId(null);
    // };

    // const handleStopRecurring = (income: Income) => {
    //     // console.log('Stop recurring for:', income.id);
    //     setOpenMenuId(null);
    // };

    const handleCloseModal = () => {
        setIsAddIncomeModalOpen(false);
        setEditingIncome(null);
    };


    const renderActions = (row: Income) => {
        return (
            <div className="flex justify-end items-center gap-2 p-3 h-full">
                <div className="flex-shrink-0">
                    <PopoverComponent
                        isOpen={openMenuId === row.id}
                        setIsOpen={(isOpen) => setOpenMenuId(isOpen ? row.id : null)}
                        body={
                            <div className="w-[180px] pr-2">
                                <div
                                    className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                                    onClick={() => handleEditIncome(row)}
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit Income
                                </div>
                                {/* {row.type === 'recurring' && (
                                    <div
                                        className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                                        onClick={() => handleStopRecurring(row)}
                                    >
                                        <Square className="h-4 w-4" />
                                        Stop Recurring
                                    </div>
                                )} */}
                                {/* <div
                                    className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                                    onClick={() => handleDeleteIncome(row)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </div> */}
                            </div>
                        }
                    >
                        <MenuIcon />
                    </PopoverComponent>
                </div>
            </div>
        );
    };

    const columns = [
        {
            header: "Source",
            field: "source" as keyof Income,
            minWidth: "200px",
            render: (value: string) => (
                <span className="font-medium p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[25px] font-medium",
        },
        {
            header: "Description",
            field: "description" as keyof Income,
            minWidth: "300px",
            render: (value: string) => (
                <span className="p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Type",
            field: "type" as keyof Income,
            minWidth: "120px",
            render: (value: string) => (
                <span className={`inline-flex p-1 px-3 text-center font-medium rounded-full text-[14px] ${value === 'recurring'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                    }`}>
                    {value}
                </span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Received Date",
            field: "date" as keyof Income,
            minWidth: "120px",
            render: (value: string) => {
                // Format date without timezone conversion
                const [year, month, day] = value.split('-');
                return (
                    <span className="p-3 text-[16px] text-gray-600">
                        {new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString()}
                    </span>
                );
            },
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Amount",
            field: "amount" as keyof Income,
            minWidth: "120px",
            render: (value: number) => (
                <span className="font-semibold p-3 text-[16px]">${value.toLocaleString()}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Receipt",
            field: "receiptUrl" as keyof Income,
            minWidth: "120px",
            render: (value: string, row: Income) => (
                <div className="flex items-center gap-2 p-3">
                    {value ? (
                        <>
                            <div
                                onClick={() => handleViewReceipt(row)}
                                className="p-1 cursor-pointer hover:bg-gray-100 rounded"
                                title="View Receipt"
                            >
                                <Eye className="h-4 w-4 text-gray-600" />
                            </div>
                            <div
                                onClick={() => handleDownloadReceipt(row)}
                                className="p-1 cursor-pointer hover:bg-gray-100 rounded"
                                title="Download Receipt"
                            >
                                <Download className="h-4 w-4 text-gray-600" />
                            </div>
                        </>
                    ) : (
                        <span className="text-gray-500 text-[14px]">No Receipt</span>
                    )}
                </div>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "",
            field: "id" as keyof Income,
            minWidth: "80px",
            render: (_value: string, row: Income) => row.id === 'billing-invoice' ? null : renderActions(row),
            headerClassName: "font-medium",
        }
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center py-12">
                    <Loader fullScreen={false} message="Loading income..." size={40} />
                </div>
            )}

            {/* Content */}
            {!isLoading && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatsCard
                            title="Total Income"
                            value={`$${totalIncome.toLocaleString()}`}
                            icon={<DollarSign className="w-5 h-5" />}
                            iconColor="text-green-600"
                            iconBgColor="bg-green-100"
                            className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                            subDescription={`(Billing Invoices $${billingInvoiceAmount.toLocaleString()} + Added Income $${addedIncome.toLocaleString()})`}
                        />
                        <StatsCard
                            title="Recurring Income"
                            value={`$${recurringIncome.toLocaleString()}`}
                            icon={<Repeat className="w-5 h-5" />}
                            iconColor="text-blue-600"
                            iconBgColor="bg-blue-100"
                            className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                        />
                        <StatsCard
                            title="One-time Income"
                            value={`$${oneTimeIncome.toLocaleString()}`}
                            icon={<Receipt className="w-5 h-5" />}
                            iconColor="text-purple-600"
                            iconBgColor="bg-purple-100"
                            className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                        />
                    </div>

                    {/* Add Income Button */}
                    <div className="flex justify-end">
                        <Button
                            name="Add Income"
                            type="button"
                            buttonClick={() => setIsAddIncomeModalOpen(true)}
                        />
                    </div>

                    {/* Income Table */}
                    <Card>
                        <CardContent>
                            <BaseTable
                                columns={columns}
                                data={tableData}
                                headerStyles="pt-[5px]"
                                rowStyles={(row) => ""}
                                cellStyles={(field, value, row) => "flex h-full"}
                                tableContainerClass="rounded-[7px] bg-white"
                                customEmptyMessage="No income recorded yet."
                            />
                        </CardContent>
                    </Card>

                    {/* Add/Edit Income Modal */}
                    <AddBudgetIncome
                        isOpen={isAddIncomeModalOpen}
                        onClose={handleCloseModal}
                        editIncome={editingIncome}
                    />
                </>
            )}
        </div>
    );
};

export default Income;