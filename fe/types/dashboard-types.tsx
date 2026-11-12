import { ReactElement } from "react";

export type NavmainType = {
    className?: string;
};
export interface SidebarCellType {
    name: string;
    icon?: ReactElement;
    active?: boolean;
    pointerEvent?:string
  }
  