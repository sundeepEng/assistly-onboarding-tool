import { Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../commonComponents/card";
import LeadsMetricsIcon from "../../../public/icons/leads-metrics-icon";
import { dashboardMetricsPath } from "../../../utils/constants";
import DashboardIcon from "../../../public/icons/dashboard-icon";

interface CardsData {
  total_leads?: { value: number };
  new_leads_7d?: { value: number };
  new_leads_30d?: { value: number };
  residents_boarded?: { value: number };
}

interface SalesRepsTopBarMetricsProps {
  cards?: CardsData;
}

const stats = (cards: CardsData | undefined) => [
  {
    title: "Total Leads",
    value: cards?.total_leads?.value ?? 0,
    description: "All leads in pipeline",
    icon: LeadsMetricsIcon,
  },
  {
    title: "New Leads (7d)",
    value: cards?.new_leads_7d?.value ?? 0,
    description: "Added in last 7 days",
    icon: LeadsMetricsIcon,
  },
  {
    title: "New Leads (30d)",
    value: cards?.new_leads_30d?.value ?? 0,
    description: "Added in last 30 days",
    icon: LeadsMetricsIcon,
  },
  {
    title: "Residents Boarded",
    value: cards?.residents_boarded?.value ?? 0,
    description: "Successfully boarded residents",
    icon: LeadsMetricsIcon,
  },
];

export function SalesRepsTopBarMetrics({ cards }: SalesRepsTopBarMetricsProps) {

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mq1024:flex mq1024:justify-center mq1024:flex-wrap">
      {stats(cards).map((stat) => {
        const Icon = stat.icon as any;
        return (
          <Card
            key={stat.title}
            className="rounded-[10px] min-w-[200px] w-auto h-[160px] p-[19px] bg-white"
          >
            <CardHeader>
              <div className="flex justify-between">
                <div className="flex flex-1 flex-col">
                  <CardTitle
                    className="text-base font-medium truncate whitespace-nowrap overflow-hidden text-ellipsis"
                    title={stat.title}
                  >
                    {stat.title}
                  </CardTitle>
                  <div
                    className="flex justify-start text-20xl font-bold text-primary"
                  >
                    {stat.value}
                  </div>
                </div>
                <div className="flex flex-1 justify-end items-start !h-full">
                  <Icon className="text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-s font-medium font-jakarta !my-[10px]">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default SalesRepsTopBarMetrics;
