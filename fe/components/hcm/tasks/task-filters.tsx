import React from "react";
import { Search } from "lucide-react";
import InputFieldComponent from "../../../commonComponents/input-field-component";

interface TaskFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    placeholder?: string;
    inputClassName?: string;
    children?: React.ReactNode;
}

const TaskFilters = ({
    search,
    onSearchChange,
    placeholder = "Search tasks...",
    children,
}: TaskFiltersProps) => {
    return (
        <div className="flex flex-col md:flex-row items-center gap-3 mb-4 p-4 border border-gray-200 rounded-xl bg-white">
            <div className="relative flex-1 w-full">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                />
                <InputFieldComponent
                    name="taskSearch"
                    label=""
                    type="text"
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    containerClass="!gap-0"
                    titleClass="!h-0"
                    className="!h-10 !px-0"
                    inputClass="pl-10 pr-4"
                />
            </div>
            {children}
        </div>
    );
};

export default TaskFilters;
