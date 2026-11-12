import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, DollarSign, Plus, Edit, Trash2, BellRing, Percent, Target, ActivitySquare, CheckCircle } from "lucide-react";
import BaseTable from "../../../commonComponents/base-table";
import StatsCard from "../../../commonComponents/stats-card";
import { Card } from "../../../commonComponents/card";
import PopoverComponent from "../../../commonComponents/popover-component";
import MenuIcon from "../../../public/icons/menu-icon";
import Button from "../../../commonComponents/button";
import AddThreshold from "./add-threshold";
import useGetById from "../../../services/getById";
import { getHomeIdFromToken } from "../../../utils/auth";
import { homePath, HOME_PATH_OMIT_FIELDS } from "../../../utils/constants";
import { extractThresholds, MONTH_ABBR } from "../../../utils/budget-utils";
import useUpsert from "../../../services/upsert";
import { useQueryClient } from "@tanstack/react-query";
import { omit } from "../../../utils/dateUtils";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import Loader from "../../../commonComponents/loader";

interface Threshold {
    id: string;
    name: string;
    category: string;
    thresholdAmount: number;
    status: 'active' | 'inactive';
    enabled: boolean;
}

export const Threshold = (dateRange: any) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editThreshold, setEditThreshold] = useState<Threshold | null>(null);

    const homeId = getHomeIdFromToken();
    const dispatch = useAppDispatch();
    const queryClient = useQueryClient();
    const { mutate: upsertHome } = useUpsert();

    const { data: homeData, isLoading: isHomeLoading } = useGetById({
        key: "home-data",
        payload: { id: homeId, path: homePath, enabled: !!homeId },
    });


    // Extract thresholds using utility function
    const thresholds = extractThresholds(homeData, dateRange?.dateRange, dateRange?.periodType);

    const totalThresholds = thresholds.length;
    const activeThresholds = thresholds.filter(t => t.enabled).length;
    const inactiveThresholds = thresholds.filter(t => !t.enabled).length;

    const handleEditThreshold = (threshold: Threshold) => {
        setEditThreshold(threshold);
        setIsAddModalOpen(true);
        setOpenMenuId(null);
    };

    const handleDeleteThreshold = (threshold: Threshold) => {
        setOpenMenuId(null);
    };

    const handleToggleThreshold = (threshold: Threshold) => {
        setOpenMenuId(null);
        if (!homeId || !dateRange?.dateRange?.startDate) return;

        const [year, monthNum] = dateRange.dateRange.startDate.split('-');
        const monthNames = MONTH_ABBR;
        const month = monthNames[parseInt(monthNum) - 1];
        const category = threshold.category.toLowerCase();

        const homeObj = homeData?.home || homeData || {};
        const existingThresholds = homeObj?.thresholds || {};
        const yearThresholds = existingThresholds[year] || {};
        const monthThresholds = yearThresholds[month] || {};
        const currentThreshold = monthThresholds[category] || {};

        const updatedThresholds = {
            ...existingThresholds,
            [year]: {
                ...yearThresholds,
                [month]: {
                    ...monthThresholds,
                    [category]: {
                        ...currentThreshold,
                        isEnabled: !threshold.enabled,
                    },
                },
            },
        };

        const cleanedData = omit(
            { ...homeObj, homeId, thresholds: updatedThresholds },
            HOME_PATH_OMIT_FIELDS
        );

        upsertHome(
            { data: cleanedData, path: homePath },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ["home-data"] });
                    dispatch(handleOpenPopover());
                    dispatch(handleShowPopoverMessage(
                        threshold.enabled ? "Threshold disabled" : "Threshold enabled"
                    ));
                },
                onError: (error: any) => {
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(
                        handleShowPopoverMessage(
                            !Array?.isArray(error?.response?.data?.error)
                                ? error?.response?.data?.error
                                : "Failed to toggle threshold."
                        )
                    );
                },
            }
        );
    };

    const handleCloseModal = () => {
        setIsAddModalOpen(false);
        setEditThreshold(null);
    };

    const renderActions = (row: Threshold) => {
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
                                    onClick={() => handleEditThreshold(row)}
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                </div>
                                <div
                                    className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                                    onClick={() => handleToggleThreshold(row)}
                                >
                                    <BellRing className="h-4 w-4" />
                                    {row.enabled ? 'Disable' : 'Enable'}
                                </div>
                                {/* <div
                                    className="p-[5px] cursor-pointer hover:bg-lightgray/20 font-poppins hover:rounded-md flex items-center gap-2"
                                    onClick={() => handleDeleteThreshold(row)}
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
            header: "Name",
            field: "name" as keyof Threshold,
            minWidth: "320px",
            render: (value: string) => (
                <span className="font-medium p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[25px] font-medium",
        },
        {
            header: "Category",
            field: "category" as keyof Threshold,
            minWidth: "150px",
            render: (value: string) => (
                <span className="p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Month",
            field: "month" as keyof Threshold,
            minWidth: "150px",
            render: (value: string) => (
                <span className="p-3 text-[16px]">{value}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Threshold Amount",
            field: "thresholdAmount" as keyof Threshold,
            minWidth: "150px",
            render: (value: number) => (
                <span className="font-semibold p-3 text-[16px]">${value.toLocaleString()}</span>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "Status",
            field: "status" as keyof Threshold,
            minWidth: "120px",
            render: (value: string, row: Threshold) => (
                <div className="flex items-center gap-2 p-3">
                    <div className={`w-2 h-2 rounded-full ${value === 'active' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                    <span className={`text-[14px] font-medium capitalize ${value === 'active' ? 'text-green-700' : 'text-red-600'
                        }`}>
                        {value}
                    </span>
                </div>
            ),
            headerClassName: "pl-[10px] font-medium",
        },
        {
            header: "",
            field: "id" as keyof Threshold,
            minWidth: "80px",
            render: (_value: string, row: Threshold) => renderActions(row),
            headerClassName: "font-medium",
        }
    ];

    if (isHomeLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <Loader fullScreen={false} message="" size={30} />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Thresholds"
                    value={totalThresholds}
                    icon={<Target className="w-5 h-5" />}
                    iconColor="text-blue-600"
                    iconBgColor="bg-blue-100"
                    className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                />
                <StatsCard
                    title="Active"
                    value={activeThresholds}
                    icon={<CheckCircle className="w-5 h-5" />}
                    iconColor="text-green-600"
                    iconBgColor="bg-green-100"
                    className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                />
                <StatsCard
                    title="Inactive"
                    value={inactiveThresholds}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    iconColor="text-red-600"
                    iconBgColor="bg-red-100"
                    className="shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                />
            </div>

            {/* Add Threshold Button */}
            <div className="flex justify-end">
                <Button
                    name="Add Threshold"
                    type="button"
                    buttonClick={() => setIsAddModalOpen(true)}
                />
            </div>

            {/* Threshold Table */}
            <Card>
                <BaseTable
                    columns={columns}
                    data={thresholds}
                    headerStyles="pt-[5px]"
                    rowStyles={(row) => ""}
                    cellStyles={(field, value, row) => "flex h-full"}
                    tableContainerClass="rounded-[7px] bg-white"
                    customEmptyMessage="No thresholds set yet."
                />
            </Card>

            {/* Add/Edit Threshold Modal */}
            <AddThreshold
                isOpen={isAddModalOpen}
                onClose={handleCloseModal}
                editThreshold={editThreshold}
                dateRange={dateRange}
                homeData={homeData}
            />
        </div>
    );
};

export default Threshold;