
import ExceptionPopover from "../../commonComponents/exception-popover";
import { useAppSelector } from "../../redux/hooks";
import DesktopLogin from "./desktop-login";
import MobileLogin from "./mobile-login";

const Login = () => {

   const isPopoverVisible = useAppSelector(
      (state: { exceptionPopover: { isPopoverVisible: boolean } }) =>
        state.exceptionPopover.isPopoverVisible
    );

  return (
    <>
      {/* Desktop for everything above 450px (includes tablets + desktop) */}
      <div className="mq761:hidden">
        <DesktopLogin />
      </div>

      {/* Mobile ONLY for 450px and below */}
      <div className="hidden mq761:block">
        <MobileLogin />
      </div>
      {isPopoverVisible && <ExceptionPopover />}
    </>
  );
};

export default Login;
