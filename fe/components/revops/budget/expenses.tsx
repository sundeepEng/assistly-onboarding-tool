import React, { useState } from "react";
import { Repeat, Receipt, Eye, Edit, Trash2, Download, Square, DollarSign, Plus } from "lucide-react";
import BaseTable from "../../../commonComponents/base-table";
import StatsCard from "../../../commonComponents/stats-card";
import { Card, CardContent } from "../../../commonComponents/card";
import PopoverComponent from "../../../commonComponents/popover-component";
import MenuIcon from "../../../public/icons/menu-icon";
import Button from "../../../commonComponents/button";
import AddBudgetExpense from "./add-budget-expense";
import { Budget } from "../../../model/revops/budget-model";
import fetchPreSignedUrl from "../../../services/get-presigned-url";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { PAYROLL } from "../../../utils/constants";

interface Expense {
    id: string;
    category: string;
    description: string;
    date: string;
    amount: number;
    type: 'recurring' | 'one-time';
    receiptUrl?: string;
}

interface ExpensesProps {
    dateRange: { startDate: string; endDate: string };
    periodType: 'monthly' | 'quarterly';
    expensesData?: any;
    payrollAmount?: number;
}

export const Expenses = ({ dateRange, periodType, expensesData, payrollAmount }: ExpensesProps) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Budget | null>(null);
    const dispatch = useAppDispatch();

    // Transform API data to match Expense interface
    const expenses: Expense[] = React.useMemo(() => {
        if (!expensesData?.budgets || !Array.isArray(expensesData.budgets)) {
            return [];
        }

        return expensesData.budgets.map((budget: any) => ({
            id: budget.id?.toString() || '',
            category: budget.category_type || '',
            description: budget.description || '',
            date: budget.transaction_date || '',
            amount: (budget.amount_cents || 0) / 100,
            type: budget.entry_mode === 'one_time' ? 'one-time' : 'recurring',
            receiptUrl: budget.receipt_url || undefined
        }));
    }, [expensesData]);

    const addedExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalExpenses = addedExpenses + payrollAmount;
    const recurringExpenses = expenses.filter(item => item.type === 'recurring').reduce((sum, item) => sum + item.amount, 0);
    const oneTimeExpenses = expenses.filter(item => item.type === 'one-time').reduce((sum, item) => sum + item.amount, 0);

    const payrollRow: Expense = {
        id: 'payroll',
        category: 'Payroll',
        description: 'Payroll Expense',
        date: dateRange?.startDate || '',
        amount: payrollAmount,
        type: 'recurring',
    };

    const tableData = [payrollRow, ...expenses];

    const handleViewReceipt = async (expense: Expense) => {
        if (!expense.receiptUrl) return;

        try {
            const url = await fetchPreSignedUrl(expense.receiptUrl);
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

    const handleEditExpense = (expense: Expense) => {
        // Find the original budget data from API to get the full Budget object
        const budgetData = expensesData?.budgets?.find((b: any) => b.id?.toString() === expense.id);
        if (budgetData) {
            setEditingExpense(budgetData);
        }
        setIsAddExpenseModalOpen(true);
        setOpenMenuId(null);
    };

    const handleDownloadReceipt = async (expense: Expense) => {
        if (!expense.receiptUrl) return;

        try {
            const url = await fetchPreSignedUrl(expense.receiptUrl);
            if (url) {
                // Fetch the file as a blob to avoid cross-origin issues
                const response = await fetch(url);
                const blob = await response.blob();

                // Create a blob URL and trigger download
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;

                // Extract file extension from URL or default to pdf
                const fileExtension = expense.receiptUrl.split('.').pop()?.split('?')[0] || 'pdf';
                link.download = `receipt_${expense.id}.${fileExtension}`;

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

    // const handleDeleteExpense = (expense: Expense) => {
    //     // console.log('Delete expense:', expense.id);
    //     setOpenMenuId(null);
    // };

    // const handleStopRecurring = (expense: Expense) => {
    //     // console.log('Stop recurring for:', expense.id);
    //     setOpenMenuId(null);
    // };

    const handleCloseModal = () => {
        setIsAddExpenseModalOpen(false);
        setEditingExpense(null);
    };

    const renderActions = (row: Expense) => {
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
                                    onClick={() => handleEditExpense(row)}
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit Expense
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
                                    onClick={() => handleDeleteExpense(row)}
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
            header: "Category",
            field: "category" as keyof Expense,
            minWidth: "200px",
            render: (value: string) => (
                <span className="font-medium p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[25px] font-medium",
        },
        {
            header: "Description",
            field: "description" as keyof Expense,
            minWidth: "300px",
            render: (value: string) => (
                <span className="p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Type",
            field: "type" as keyof Expense,
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
            header: "Paid Date",
            field: "date" as keyof Expense,
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
            field: "amount" as keyof Expense,
            minWidth: "120px",
            render: (value: number) => (
                <span className="font-semibold p-3 text-[16px]">${value.toLocaleString()}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Receipt",
            field: "receiptUrl" as keyof Expense,
            minWidth: "120px",
            render: (value: string, row: Expense) => (
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
            field: "id" as keyof Expense,
            minWidth: "80px",
            render: (_value: string, row: Expense) => row.id === PAYROLL ? null : renderActions(row),
            headerClassName: "font-medium",
        }
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Expenses"
                    value={`$${totalExpenses.toLocaleString()}`}
                    icon={<DollarSign className="w-5 h-5" />}
                    iconColor="text-green-600"
                    iconBgColor="bg-green-100"
                    className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                    subDescription={`(Payroll $${payrollAmount.toLocaleString()} + Added Expenses $${addedExpenses.toLocaleString()})`}
                />
                <StatsCard
                    title="Recurring Expenses"
                    value={`$${recurringExpenses.toLocaleString()}`}
                    icon={<Repeat className="w-5 h-5" />}
                    iconColor="text-blue-600"
                    iconBgColor="bg-blue-100"
                    className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                />
                <StatsCard
                    title="One-time Expenses"
                    value={`$${oneTimeExpenses.toLocaleString()}`}
                    icon={<Receipt className="w-5 h-5" />}
                    iconColor="text-purple-600"
                    iconBgColor="bg-purple-100"
                    className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                />
            </div>

            {/* Add Expense Button */}
            <div className="flex justify-end">
                <Button
                    name="Add Expense"
                    type="button"
                    buttonClick={() => setIsAddExpenseModalOpen(true)}
                />
            </div>

            {/* Expenses Table */}
            <Card>
                <CardContent>
                    <BaseTable
                        columns={columns}
                        data={tableData}
                        headerStyles="pt-[5px]"
                        rowStyles={(row) => ""}
                        cellStyles={(field, value, row) => "flex h-full"}
                        tableContainerClass="rounded-[7px] bg-white"
                        customEmptyMessage="No expenses recorded yet."
                    />
                </CardContent>
            </Card>

            {/* Add/Edit Expense Modal */}
            <AddBudgetExpense
                isOpen={isAddExpenseModalOpen}
                onClose={handleCloseModal}
                editExpense={editingExpense}
            />
        </div>
    );
};

export default Expenses;