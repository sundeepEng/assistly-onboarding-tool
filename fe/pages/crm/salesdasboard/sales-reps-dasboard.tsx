import { useMemo, useState } from "react";
import Button from "../../../commonComponents/button";
import FunnelChart, { FunnelChartData } from "../../../commonComponents/funnel-chart";
import SelectComponent from "../../../commonComponents/select-component";
import SalesRepsTopBarMetrics from "../../../components/crm/sales-reps/sales-reps-top-bar-metrics";
import PlusIcon from "../../../public/icons/plus-icon";
import { handleOpenAddLeadModal } from "../../../redux/slices/modal-slice";
import { setMilestoneFilter } from "../../../redux/slices/leads-filter-slice";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import useGetAll from "../../../services/getAll";
import { salesMetricsPath, THEME_PALETTE, dateRangeOptions, REP_COMPARISON_SERIES, milestones } from "../../../utils/constants";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";
import BarChart from "../../../commonComponents/bar-chart";
import Loader from "../../../commonComponents/loader";
import StackedBarChart from "../../../commonComponents/stacked-bar-chart";


const SEGMENT_MILESTONE_MAP: Record<string, string> = {
    initial: milestones.INITIAL_CONTACT,
    tour: milestones.TOUR,
    signed: milestones.CONTRACT,
    boarded: milestones.ON_BOARDING,
};

export default function SalesRepsDashboard() {
    const dispatch = useDispatch();
    const router = useRouter();
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
        key: "salesMetrics",
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

    const yourPerformanceStackedData = useMemo(() => {
        const reps = (salesMetricsData as any)?.rep_performance as any[] | undefined;
        if (!reps || reps.length === 0) return [];
        return reps.map((r) => ({
            label: r.name ?? "",
            segments: [
                { key: "initial", value: r.funnel?.initial_contact ?? 0 },
                { key: "tour", value: r.funnel?.home_tour ?? 0 },
                { key: "signed", value: r.funnel?.signed ?? 0 },
                { key: "boarded", value: r.funnel?.boarded ?? 0 },
            ],
        }));
    }, [salesMetricsData]);

    const repComparisonStackedData = useMemo(() => {
        if (!(salesMetricsData as any)?.sales_metrics?.per_rep_metrics) return [];
        return (salesMetricsData as any)?.sales_metrics?.per_rep_metrics.map((r: any) => ({
            label: r.name,
            segments: [
                { key: "initial", value: r.initial },
                { key: "tour", value: r.tour },
                { key: "signed", value: r.signed },
                { key: "boarded", value: r.boarded },
            ],
        }));
    }, [salesMetricsData]);

    const lostReasonsChartData = useMemo(() => {
        const reasons = (salesMetricsData as any)?.lost_by_reason as Record<string, number> | undefined;
        if (!reasons || Object.keys(reasons).length === 0) return [];
        return Object.entries(reasons).map(([label, value]) => ({ label, value, color: THEME_PALETTE.danger }));
    }, [salesMetricsData]);

    return (
        <div>
            <div className="flex justify-between items-center">
                <div className="">
                    <div className="text-heading font-bold font-jakarta">Sales Dashboard</div>
                    <div>Monitor your performance, stage health, and conversion trends</div>
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
                    {/* Topbar metrics */}
                    <SalesRepsTopBarMetrics cards={(salesMetricsData as any)?.cards} />
                    {yourPerformanceStackedData.length > 0 && (
                        <div className="space-y-2 bg-white p-4 rounded-lg">
                            <h2 className="text-lg font-semibold font-jakarta mb-2">Your Performance</h2>
                            <StackedBarChart
                                data={yourPerformanceStackedData}
                                series={REP_COMPARISON_SERIES}
                                width={1000}
                                height={Math.max(130, yourPerformanceStackedData.length * 60)}
                                showLegend={true}
                                lightTooltip={true}
                                margin={{ top: 10, right: 30, bottom: 50, left: 140 }}
                                onSegmentClick={(_row, _segment, seriesKey) => {
                                    const milestone = SEGMENT_MILESTONE_MAP[seriesKey];
                                    if (milestone) {
                                        dispatch(setMilestoneFilter(milestone));
                                        router.push("/crm");
                                    }
                                }}
                            />
                        </div>
                    )}
                    {repComparisonStackedData.length > 0 && (
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
                    )}
                    <div className="flex gap-4">
                        <div className="space-y-2 bg-white p-4 rounded-lg">
                            <h2 className="text-lg font-semibold font-jakarta mb-2">My Pipeline Funnel</h2>
                            <FunnelChart data={funnelChartData} width={550} height={320} />
                        </div>

                        <div className="space-y-2 bg-white p-4 rounded-lg w-[580px]">
                            <h2 className="text-lg font-semibold font-jakarta mb-2">Why Leads Were Lost</h2>
                            <BarChart
                                data={lostReasonsChartData}
                                width={500}
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
                    </div>
                </>)}
            </div>
        </div>
    );
}