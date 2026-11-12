import classNames from "classnames";
import type { NextPage } from "next";
import { useEffect, useState } from "react";
import PopoverComponent from "./popover-component";
import { PASS, REFUSE } from "../utils/constants";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import { useDispatch } from "react-redux";

export type ToggleButtonType = {
  className?: string;
  onChange?: (state: string) => void;
  passName: string;
  refuseName: string;
  comments?: boolean;
  ToggleBody?: any;
  initialState?: string; // Added to maintain state after refresh
  editAccess?: boolean;
  disabled?: boolean;
  isTimeValid?: boolean;
  allowUnselect?: boolean;
};

const ToggleButton: NextPage<ToggleButtonType> = ({
  className = "",
  passName = PASS,
  refuseName = REFUSE,
  onChange,
  comments,
  ToggleBody,
  initialState = "", // NEW: Initial toggle state
  editAccess = true,
  disabled = false,
  isTimeValid = true,
  allowUnselect = false,
}) => {
  const [activeState, setActiveState] = useState(initialState || "");
  const dispatch = useDispatch();

  // Keep internal state aligned when the prop changes (e.g. selecting a different date)
  useEffect(() => {
    setActiveState(initialState || "");
  }, [initialState]);

  const handleToggle = (state: string) => {
    if (!isTimeValid || !editAccess) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "Medication can't be given before scheduled time!"
        ),
      );
      return;
    }

    if (allowUnselect && activeState === state) {
      setActiveState("");
      onChange?.("");
      return;
    }

    setActiveState(state);
    onChange?.(state);
  };
  const getActiveButton = (isActive: boolean) =>
    classNames("flex flex-row items-center justify-center p-2.5", {
      ["bg-[#19D139]"]: isActive && activeState === passName,
      "bg-[#00000038] ": isActive && activeState === refuseName,
      "bg-[#D9D9D9]": !isActive,
    });
  const [open, setIsOpen] = useState(false);
  return (
    <div className={classNames("flex", className)}>
      <button
        className={`${editAccess && !disabled ? "cursor-pointer" : "cursor-not-allowed"
          } p-0 bg-none rounded-3xs flex flex-row`}
        disabled={!editAccess || disabled}
      >
        <div
          className={`${getActiveButton(
            activeState === passName,
          )} rounded-tl-3xs rounded-tr-none rounded-br-none rounded-bl-3xs text-[black] shadow-[0px_0px_4px_rgba(0,_0,_0,_0.25)_inset]`}
          onClick={() => {
            if (disabled) return;
            handleToggle(passName);
            setIsOpen(false);
          }}
        >
          <div className="text-base font-poppins text-center">{passName}</div>
        </div>
        {comments ? (
          <PopoverComponent
            isOpen={open}
            body={
              activeState === refuseName ? (
                <div>
                  <ToggleBody setOpen={setIsOpen} />
                </div>
              ) : null
            }
            setIsOpen={setIsOpen}
          >
            <div
              className={`${getActiveButton(
                activeState === refuseName,
              )} rounded-tl-none rounded-tr-3xs rounded-br-3xs rounded-bl-none`}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                if (!isTimeValid || !editAccess) {
                  handleToggle(refuseName);
                  return;
                }

                if (allowUnselect && activeState === refuseName) {
                  setActiveState("");
                  onChange?.("");
                  setIsOpen(false);
                  return;
                }

                setActiveState(refuseName);
                onChange?.(refuseName);
                setIsOpen(true);
              }}
            >
              <div className="text-base font-poppins text-center">
                {refuseName}
              </div>
            </div>
          </PopoverComponent>
        ) : (
          <div
            className={`${getActiveButton(
              activeState === refuseName,
            )} rounded-tl-none rounded-tr-3xs rounded-br-3xs rounded-bl-none`}
            onClick={() => {
              if (disabled) return;
              handleToggle(refuseName);
            }}
          >
            <div className="text-base font-poppins text-center">
              {refuseName}
            </div>
          </div>
        )}
      </button>
    </div>
  );
};

export default ToggleButton;
