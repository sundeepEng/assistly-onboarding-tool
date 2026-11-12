import React from "react";
import { AlertTriangle } from "lucide-react";
import Alert from "../../../commonComponents/alert";
import { Card, CardContent } from "../../../commonComponents/card";
import { generateBudgetAlerts } from "../../../utils/budget-utils";
import useGetById from "../../../services/getById";
import { getHomeIdFromToken } from "../../../utils/auth";
import { homePath } from "../../../utils/constants";

interface BudgetAlertsProps {
    dateRange?: { startDate: string; endDate: string };
    periodType?: 'monthly' | 'quarterly';
    dashboardMetricsData?: any;
}

export const BudgetAlerts = ({ dateRange, dashboardMetricsData }: BudgetAlertsProps) => {
    const homeId = getHomeIdFromToken();

    const { data: homeData, isLoading: isHomeLoading } = useGetById({
        key: "home-data",
        payload: { id: homeId, path: homePath, enabled: !!homeId },
    });

    const alerts = generateBudgetAlerts(homeData, dashboardMetricsData, dateRange);

    return (
        <div className="p-6">
            <Card>
                <CardContent className="space-y-3">
                    {alerts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No budget alerts at this time.
                        </div>
                    ) : (
                        alerts.map((alert) => (
                            <Alert
                                key={alert.id}
                                bgColor={alert.type === 'critical' ? 'bg-red-50' : 'bg-yellow-50'}
                                borderColor={alert.type === 'critical' ? 'border-red-200' : 'border-yellow-200'}
                                textColor={alert.type === 'critical' ? 'text-red-800' : 'text-yellow-800'}
                                icon={alert.type === 'critical'
                                    ? <AlertTriangle />
                                    : <AlertTriangle className="h-5 w-5 inline" />
                                }
                            >
                                <div>
                                    <span className="font-semibold">{alert.thresholdName}</span>
                                    <span className="bg-white border border-gray-200 font-medium text-gray-500 px-2 py-1 rounded-md text-xs ml-2">{alert.category}</span>
                                </div>
                                <p className="mt-1">{alert.message}</p>
                                <p className="text-xs mt-1 opacity-75">
                                    Usage: {alert.percentageUsed}% (${alert.currentValue.toLocaleString()} / ${alert.thresholdValue.toLocaleString()})
                                </p>
                            </Alert>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default BudgetAlerts;