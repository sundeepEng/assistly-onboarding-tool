import type { NextPage } from "next";
import GridIcon from "../public/icons/grid-icon";
import TileIcon from "../public/icons/tile-icon";

export type ToggleType = {
  className?: string;
  toggelState: boolean; // true for Grid, false for Tile
  setToggleState: React.Dispatch<React.SetStateAction<boolean>>;
  state1?:string,
  state2?:string
};

const Toggle: NextPage<ToggleType> = ({
  className = "",
  toggelState = true, // Default to Grid view
  setToggleState,
  state1="",
  state2=""
}) => {
  return (
    <div
      className={`w-fit overflow-hidden flex flex-col items-start justify-start pt-[15px] px-5 box-border leading-[normal] tracking-[normal] cursor-pointer ${className}`}
    >
      <div className="self-stretch flex flex-row items-center justify-start">
        <div className="flex-1 flex flex-row items-center justify-between ">
          {/* Tile Icon */}
          <div onClick={() => setToggleState(false)}>
            {state1?<div className={`flex  w-[150px] h-[50px] justify-center items-center rounded-l-[5px] ${!toggelState?"bg-black text-white font-semibold":"bg-darkgray-100 text-darkgray-500"}`}>{state1}</div> :<div className="px-[10px]"><TileIcon active={!toggelState} /></div>}
          </div>

          {/* Grid Icon */}
          <div onClick={() => setToggleState(true)}>
           {state2?<div className={`flex w-[150px] h-[50px] justify-center items-center rounded-r-[5px] ${toggelState?"bg-[black] text-white font-semibold":"bg-darkgray-100 text-darkgray-500"}`}>{state2}</div> :<div className="px-[10px]"><GridIcon active={toggelState} /></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toggle;
