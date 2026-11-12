import { GetSignature } from "../utils/getSignatureUtil";

export const ReportedByCell = ({ id,date }) => {
    const user = GetSignature(id);
    return (
        <div className="flex flex-col !items-center">
            <div className="flex font-[500] font-poppins text-blue-700 text-[19px]">
                {user.initials}
            </div>
            <div className="flex text-gray-500 text-xs">
                {date}
            </div>
        </div>
    );
};



import { formatUtcToLocalDisplay } from "../utils/dateUtils";
import { getInitials } from "../utils/getSignatureUtil";

const IncidentReportedBy = ({ reporterName,reportedDate }) => {
    return (
        <div className="flex flex-col !items-center">
            <div className="flex font-[500] font-poppins text-blue-700 text-[19px]">
                {getInitials(reporterName)}
            </div>
            <div className="flex text-gray-500 text-xs">
                {formatUtcToLocalDisplay(reportedDate)}
            </div>
        </div>
    );
};

export default IncidentReportedBy;
