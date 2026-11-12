import { useDispatch } from "react-redux";
import FunnelChart, { FunnelChartData } from "../../../commonComponents/funnel-chart";
import { useMemo, useState } from "react";
import { getHomeIdFromToken, getIdToken, getUserIdFromToken } from "../../../utils/auth";
import useGetAll from "../../../services/getAll";
import { salesMetricsPath } from "../../../utils/constants";
import SelectComponent from "../../../commonComponents/select-component";
import Button from "../../../commonComponents/button";
import PlusIcon from "../../../public/icons/plus-icon";
import SalesRepsTopBarMetrics from "../../../components/crm/sales-reps/sales-reps-top-bar-metrics";
import StackedBarChart from "../../../commonComponents/stacked-bar-chart";
import BarChart from "../../../commonComponents/bar-chart";
import PerRepMetricsTable, { PerRepMetric } from "../../../components/crm/sales-reps/per-rep-metrics-table";
import { handleOpenAddLeadModal } from "../../../redux/slices/modal-slice";
import Loader from "../../../commonComponents/loader";
import { dateRangeOptions, THEME_PALETTE, SERIES_COLORS } from "../../../utils/constants";

export default function SalesDirectorDashboard() {
    const dispatch = useDispatch();
    const [dateRange, setDateRange] = useState("30");
    const loggedInUserId = getUserIdFromToken();
    const loggedInHomeId = getHomeIdFromToken();


    const { startDate, endDate } = useMemo(() => {
        const days = Number(dateRange);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(end.getDate() - (days - 1));
        start.setHours(0, 0, 0, 0);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    }, [dateRange]);

    const { data: salesMetricsData, isLoading } = useGetAll({
        key: "salesMetricsDirector",
        path: salesMetricsPath,
        params: { userId: loggedInUserId, homeId: loggedInHomeId, start_date: startDate, end_date: endDate },
    });

    const funnelChartData: FunnelChartData[] = useMemo(() => {
        const f = (salesMetricsData as any)?.funnel;
        if (!f) return [];
        return [
            { label: "Initial Contact", value: f.initial_contact ?? 0 },
            { label: "Home Tour", value: f.home_tour ?? 0 },
            { label: "Agreement Signed", value: f.signed ?? 0 },
            // { label: "Boarded", value: f.boarded ?? 0 },
            { label: "Lost", value: f.lost ?? 0 },
        ];
    }, [salesMetricsData]);

    const lostReasonsChartData = useMemo(() => {
        const reasons = (salesMetricsData as any)?.lost_by_reason as Record<string, number> | undefined;
        if (!reasons || Object.keys(reasons).length === 0) return [];
        return Object.entries(reasons).map(([label, value]) => ({ label, value, color: THEME_PALETTE.danger }));
    }, [salesMetricsData]);

    const perRepMetrics: PerRepMetric[] = useMemo(() => {
        const reps = (salesMetricsData as any)?.rep_performance as any[] | undefined;
        if (!reps || reps.length === 0) return [];
        return reps.map((r) => ({
            name: r.name ?? "",
            initial: r.funnel?.initial_contact ?? 0,
            tour: r.funnel?.home_tour ?? 0,
            signed: r.funnel?.signed ?? 0,
            boarded: r.funnel?.boarded ?? 0,
            lost: r.funnel?.lost ?? 0,
            newLeads7: r.newLeads7 ?? 0,
            newLeads30: r.newLeads30 ?? 0,
            conversionPercentage: r.conversionPercentage ?? 0,
            averageAge: r.averageAge ?? { value: 0, unit: "days" },
        }));
    }, [salesMetricsData]);

    const { stackedData, series } = useMemo(() => {
        const raw = (salesMetricsData as any)?.loss_reasons_by_rep as any[] | undefined;
        if (!raw || raw.length === 0) return { stackedData: [], series: [] };
        const allReasonKeys = Array.from(
            new Set(raw.flatMap((r) => Object.keys(r.lost_by_reason ?? {})))
        );
        if (allReasonKeys.length === 0) return { stackedData: [], series: [] };
        const dynamicSeries = allReasonKeys.map((key, i) => ({
            key,
            label: key,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
        }));
        const data = raw
            .filter((r) => Object.keys(r.lost_by_reason ?? {}).length > 0)
            .map((r) => ({
                label: r.name ?? "",
                segments: allReasonKeys.map((k) => ({ key: k, value: (r.lost_by_reason?.[k] as number) ?? 0 })),
            }));
        return { stackedData: data, series: dynamicSeries };
    }, [salesMetricsData]);

    return (
        <div>
            <div className="flex justify-between items-center">
                <div className="">
                    <div className="text-heading font-bold font-jakarta">Sales Dashboard</div>
                    <div>Monitor rep performance, stage health, and team conversion trends</div>
                </div>
                <div className="flex items-end gap-3">
                    <SelectComponent
                        name="dateRange"
                        options={dateRangeOptions}
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="!w-[160px]"
                    />
                    <Button name={"Add New"} icon={<PlusIcon color="white" />} classname="!text-white w-[139px] h-[40px]" iconStart={true} buttonClick={() => { dispatch(handleOpenAddLeadModal()) }} />
                </div>
            </div>
            {/* Sales Dashboard */}
            <div className="mt-4 flex flex-col gap-4">
                {isLoading && (
                    <div className="flex items-center justify-center h-64">
                        <Loader />
                    </div>
                )}
                {!isLoading && (<>
                    <SalesRepsTopBarMetrics cards={(salesMetricsData as any)?.cards} />
                    <PerRepMetricsTable data={perRepMetrics} />

                    <div className="flex gap-4">
                        {lostReasonsChartData.length > 0 && (
                            <div className="space-y-2 bg-white p-4 rounded-lg">
                                <h2 className="text-lg font-semibold font-jakarta mb-2">Why Leads Were Lost</h2>
                                <BarChart
                                    data={lostReasonsChartData}
                                    width={600}
                                    height={300}
                                    orientation="horizontal"
                                    showGrid={false}
                                    showValues={false}
                                    colors={[THEME_PALETTE.danger]}
                                    margin={{ top: 10, right: 30, bottom: 20, left: 120 }}
                                    tooltipFormat={(d) => `${d.label}: ${d.value}`}
                                    animated={false}
                                />
                            </div>
                        )}
                        {stackedData.length > 0 && (
                            <div className="space-y-2 bg-white p-4 rounded-lg w-full">
                                <h2 className="text-lg font-semibold font-jakarta mb-2">Lost Reasons by Rep</h2>
                                <StackedBarChart data={stackedData} series={series} width={500} height={320} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 bg-white p-4 rounded-lg">
                        <h2 className="text-lg font-semibold font-jakarta mb-2">Pipeline Funnel</h2>
                        <FunnelChart data={funnelChartData} width={550} height={320} />
                    </div>


                    {/* {repComparisonStackedData.length > 0 && (
                        <div className="space-y-2 bg-white p-4 rounded-lg">
                            <h2 className="text-lg font-semibold font-jakarta mb-2">Rep Performance Comparison</h2>
                            <StackedBarChart
                                data={repComparisonStackedData}
                                series={REP_COMPARISON_SERIES}
                                width={1000}
                                height={Math.max(280, repComparisonStackedData.length * 60)}
                                showLegend={true}
                                lightTooltip={true}
                                margin={{ top: 10, right: 30, bottom: 50, left: 140 }}
                            />
                        </div>
                    )} */}
                </>)}
            </div>
        </div>
    );
}