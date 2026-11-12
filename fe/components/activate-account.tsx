import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useState, useEffect } from "react";
import Button from "../commonComponents/button";
import ExceptionPopover from "../commonComponents/exception-popover";
import Form from "../commonComponents/form";
import FormInputFieldComponent from "../commonComponents/form-input-field-component";
import { ArrowLeft } from "lucide-react";
import DesktopLogin from "./login/desktop-login";
import AssistlyLogo from "../public/icons/assistly";
import { useAppSelector } from "../redux/hooks";
import {
  handleClosePopover,
  handleHideCloseOptions,
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import useUpdatePassword from "../services/update-user-password";
import { activateAccountSchema } from "../model/crm/user.model";
import {
  decodeJwtToken,
  useCookieListener,
} from "../utils/auth";
import { ACCESS_TOKEN, ID_TOKEN, USER_ID } from "../utils/constants";

const ActivationFormContent = ({
  decodedEmail,
  isLoading,
  onSubmit,
  onBack,
}: {
  decodedEmail: string;
  isLoading: boolean;
  onSubmit: (data: any) => void;
  onBack: () => void;
}) => {
  return (
    <div className="flex-col items-start justify-start w-full">
      <div className="flex mb-8 font-[20px] gap-4 items-center">
        <AssistlyLogo />
        <span className="flex text-[32px] font-semibold font-jakarta">
          assistly
        </span>
      </div>

      <h2 className="text-3xl font-[500] mb-2">Activate Your Account</h2>
      <div className="h-2" />

      <Form
        schema={activateAccountSchema}
        onSubmit={onSubmit}
        defaultValues={{ email: decodedEmail }}
        key={decodedEmail || "empty"}
      >
        <div className="flex flex-col gap-4 w-full">
          <FormInputFieldComponent
            label={"Email"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Enter your email"
            name={"email"}
            readOnly={true}
          />

          <FormInputFieldComponent
            label={"Password"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Enter your password"
            name={"password"}
            passwordVisibility={true}
          />

          <FormInputFieldComponent
            label={"Re-enter Password"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Re-enter your password"
            name={"confirmPassword"}
            passwordVisibility={true}
          />

          <Button
            name="Activate Account"
            classname="w-full bg-primary hover:bg-primary text-white"
            buttonClick={() => {}}
            isLoading={isLoading}
          />
        </div>
      </Form>

      <div className="flex justify-between pt-[10px]">
        <div
          onClick={onBack}
          className="flex cursor-pointer text-primary items-center gap-1"
        >
          <ArrowLeft />
          <div>Back to login</div>
        </div>
      </div>
    </div>
  );
};

const ActivateAccountPage: NextPage = () => {
  const router = useRouter();
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [decodedEmail, setDecodedEmail] = useState<string>("");
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: updateAuthMutate } = useUpdatePassword();

  const isValidSession = useCookieListener([ID_TOKEN, ACCESS_TOKEN, USER_ID]);

 useEffect(() => {
  if (!router.isReady) return;

  const token = router.query.token;
  const t = typeof token === "string" ? token : Array.isArray(token) ? token[0] : null;

  setActivationToken(t);

  if (t) {
    const payload = decodeJwtToken(t);
    const emailFromToken = payload?.email;
    if (typeof emailFromToken === "string") {
      setDecodedEmail(emailFromToken);
    }
  }
}, [router.isReady, router.query.token]);

  useEffect(() => {
    if (isValidSession) {
      router.push("/");
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("User already logged in!"));
    }
  }, [isValidSession]);

  const isPopoverVisible = useAppSelector(
    (state: any) => state.exceptionPopover.isPopoverVisible
  );
  const isError = useAppSelector(
    (state: any) => state.exceptionPopover.popoverCloseOptions
  );

  useEffect(() => {
    if (isPopoverVisible && !isError) {
      const timer = setTimeout(() => {
        dispatch(handleClosePopover());
        dispatch(handleShowPopoverMessage(""));
        dispatch(handleHideCloseOptions());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isPopoverVisible]);

  const onActivateAccount = (data: any) => {
    setIsLoading(true);
    const { email, password, confirmPassword } = data;

    const payload: any = {
      body: { email: email.trim().toLowerCase(), password, confirmPassword, token: activationToken },
      path: "/activate-account", 
      type: "ACTIVATE_ACCOUNT",
    };

    updateAuthMutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Account Activated Successfully!"));
        setIsLoading(false);
        setTimeout(() => {
          router.push("/");
        }, 1500);
      },
      onError: (error: any) => {
        const errMsg = error ? error?.error : "Failed to activate account";
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errMsg));
        setIsLoading(false);
      },
    });
  };
  
  return (
    <>
      <div className="hidden mq761:flex min-h-screen font-poppins">
        <div className="flex flex-1 flex-col justify-center items-center p-6 md:p-12 overflow-y-auto w-full">
          <ActivationFormContent
            decodedEmail={decodedEmail}
            isLoading={isLoading}
            onSubmit={onActivateAccount}
            onBack={() => router.push("/")}
          />
        </div>
      </div>

      <div className="mq761:hidden w-full">
        <DesktopLogin initialScreen="ACTIVATE_ACCOUNT" />
      </div>

      {isPopoverVisible && <ExceptionPopover />}
    </>
  );
};

export default ActivateAccountPage;