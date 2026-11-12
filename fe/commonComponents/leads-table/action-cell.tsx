import Image from "next/image";
import WarningIcon from "../../public/icons/warning-icon";

export default function ActionCell() {
    return (
        <div className="h-12 flex flex-row items-center justify-center box-border ">
            <WarningIcon/>
        </div>
    );
}
