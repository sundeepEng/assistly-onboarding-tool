import { ReactNode } from "react";
import CrossIcon from "../public/icons/cross-icon";

export interface AlertProps {
  children: ReactNode;
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  icon?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({
  children,
  bgColor = "bg-yellow-50",
  borderColor = "border-yellow-200",
  textColor = "text-yellow-800",
  icon,
  onDismiss,
  className = "",
}) => {
  return (
    <div className={`${bgColor} ${borderColor} rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className={`text-sm ${textColor} flex flex-row gap-2 items-start`}>
          {icon && <span className="flex items-start mt-4">{icon}</span>}
          <div>{children}</div>
        </div>
        {onDismiss && (
          <div
            onClick={onDismiss}
            className={`ml-4 ${textColor} cursor-pointer`}
          >
            <CrossIcon />
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;
