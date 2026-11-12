import { ReactNode } from "react";

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  valueColor?: string;
  subDescription?: string;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  valueColor = "text-foreground",
  subDescription,
  className = "",
}) => {
  return (
    <div className={`p-6 bg-white !font-poppins rounded-lg shadow-sm ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`mt-2 text-[24px] font-medium ${valueColor}`}>{value}</p>
          {subDescription && <p className="-mt-2 text-[14px] font-medium">{subDescription}</p>}
        </div>
        {icon && (
          <div className={`rounded-lg p-3 ${iconBgColor}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
