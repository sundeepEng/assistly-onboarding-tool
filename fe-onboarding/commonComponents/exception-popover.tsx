import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import SuccessIcon from "../public/icons/success-icon";
import { useAppSelector } from "../redux/hooks";
import WarningIcon from "../public/icons/warning-icon";
import { useRef } from "react";
import {
  handleClosePopover,
  handleHideCloseOptions
} from "../redux/slices/exception-popover-slice";
import { useDispatch } from "react-redux";

const ExceptionPopover = () => {
  const [visible, setVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const popoverMessage = useAppSelector(
    (state: { exceptionPopover: { popoverMessage: string } }) =>
      state.exceptionPopover.popoverMessage
  );
  const showWarningMessage=useAppSelector(
    (state: { exceptionPopover: { showWarningMessage: boolean } }) =>
      state.exceptionPopover.showWarningMessage
  );
  const popoverCloseOptions = useAppSelector(
    (state: {
      exceptionPopover: {
        popoverCloseOptions: boolean;
      };
    }) => state.exceptionPopover.popoverCloseOptions
  );
  useEffect(() => {
    // Create or find the portal container
    let portalRoot = document.getElementById("popover-portal");
    if (!portalRoot) {
      portalRoot = document.createElement("div");
      portalRoot.id = "popover-portal";
      document.body.appendChild(portalRoot);
    }
    setPortalElement(portalRoot);

    // Set the global styles for the portal to ensure it's above everything
    portalRoot.style.position = "fixed";
    portalRoot.style.top = "0";
    portalRoot.style.left = "0";
    portalRoot.style.width = "100%";
    portalRoot.style.height = "100%";
    portalRoot.style.pointerEvents = "none"; // Allow clicking through when no popover
    portalRoot.style.zIndex = "9999"; // Ultra high z-index to be above all modals

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsClosing(true);
        dispatch(handleHideCloseOptions());
        dispatch(handleClosePopover());
        setTimeout(() => setVisible(false), 200); // fade out duration
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  if (!portalElement || !visible) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="flex w-full h-full pointer-events-auto">
      <div
        className="fixed inset-0 flex justify-center items-start"
        style={{
          pointerEvents: "auto", // Enable interactions with the popover
        }}
      >
        <div
          className={`px-[10px] flex-col bg-[#FFFFFF] p-2 rounded-lg shadow-lg w-auto !min-w-lg h-[auto] flex items-center justify-center transform transition-all duration-300 ease-in-out mt-4
                    `}
          ref={popoverRef}
        >
          <div className="flex gap-4 justify-center align-center items-center">
            <div className="flex w-[40px] h-[40px]">
              {popoverCloseOptions ? (
                <WarningIcon
                  fill={`${showWarningMessage ? "#F7BB17" : "red"}`}
                  height={40}
                />
              ) : (
                <SuccessIcon />
              )}
            </div>
            <div className="text-[20px] text-[black]">{popoverMessage}</div>
          </div>
          {/* TODO: Need requirement for close button in case of error */}
          {/* <div>
                        {popoverClose && (
                            <div>
                                <div>
                                    <Button
                                        name={"Close"}
                                        classname=""
                                        buttonClick={function (): void {
                                            throw new Error(
                                                "Function not implemented."
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div> */}
        </div>
      </div>
    </div>,
    portalElement
  );
};

export default ExceptionPopover;