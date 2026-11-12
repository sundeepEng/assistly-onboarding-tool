import { SidebarCellType } from "../types/dashboard-types";

export default function SidebarCell({ name, icon, active,pointerEvent }: SidebarCellType) {
  return (
    <div className={`flex flex-col items-start justify-center py-[5px] pl-[30px] ${pointerEvent||"cursor-pointer"}`}>
      <div className={`flex text-gray ${active && "!text-primary font-semibold"}`}>
        <div className="flex items-end h-[25px] w-[30px]">{icon?icon:" "}</div>
        <div
          className={`flex items-end font-jakarta font-semibold text-base`}
        >
          {name}
        </div>
      </div>
    </div>
  );
}
