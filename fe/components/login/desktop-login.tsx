import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Button from "../../commonComponents/button";
import ExceptionPopover from "../../commonComponents/exception-popover";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import { RoleContext } from "../role-provider";
import {
  forgotPasswordSchema,
  loginSchema,
  resetSchema,
  activateAccountSchema,
} from "../../model/crm/user.model";
import { useAppSelector } from "../../redux/hooks";
import ReactCodeInput from "react-code-input";
import {
  handleClosePopover,
  handleHideCloseOptions,
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import useAuthenticateUser from "../../services/authenticate-user";
import {
  decodeJwtToken,
  getUserIdFromToken,
  getUserRoleFromToken,
  useCookieListener,
  getHomeIdFromToken,
  setIsSalesRequiredInCookie,
  getIsSalesRequiredFromCookie,
} from "../../utils/auth";
import {
  ACCESS_TOKEN,
  confirmResetPasswordPath,
  ID_TOKEN,
  resetPasswordPath,
  USER_ID,
  userSigninPath,
  homePath,
} from "../../utils/constants";
import { getInitialRoute } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { ArrowLeft } from "lucide-react";
import useUpdatePassword, {
  ConfirmResetPasswordType,
  ResetPasswordType,
} from "../../services/update-user-password";
import useGetById, { fetchById } from "../../services/getById";

type Screen =
  | "LOGIN"
  | "FORGOT_PASSWORD"
  | "OTP_RESET_PASSWORD"
  | "ACTIVATE_ACCOUNT";

type DesktopLoginProps = {
  initialScreen?: Screen;
};

const DesktopLogin: NextPage<DesktopLoginProps> = ({
  initialScreen,
}) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const isValidSession = useCookieListener([ID_TOKEN, ACCESS_TOKEN, USER_ID]);
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    initialScreen ?? "LOGIN",
  );
  const [otp, setOtp] = useState<number>();
  const [email, setEmail] = useState<string>();
  const { mutate } = useAuthenticateUser();
  const [isLoading, setIsLoading] = useState(false);

  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [decodedActivationEmail, setDecodedActivationEmail] = useState<string>("");
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const userId = getUserIdFromToken();
  const roleRoute = getInitialRoute(role as Role, userId);

  useEffect(() => {
    if (role && userId) {
      const route = getInitialRoute(role as Role, userId);
      setInitialRoute(route);
    }
  }, [role, userId]);
  useEffect(() => {
    if (isValidSession && initialRoute) {
      router.push(roleRoute);
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("User already logged in!"));
    }
  }, [initialRoute]);

  useEffect(() => {
    if (!router.isReady) return;
    if (currentScreen !== "ACTIVATE_ACCOUNT") return;

    const token = router.query.token;
    const t =
      typeof token === "string" ? token : Array.isArray(token) ? token[0] : null;
    setActivationToken(t);

    if (t) {
      const payload = decodeJwtToken(t);
      const emailFromToken = payload?.email;
      if (typeof emailFromToken === "string") {
        setDecodedActivationEmail(emailFromToken);
      }
    }
  }, [router.isReady, router.query.token, currentScreen]);
  const onSignInButtonClick = (data: any) => {
    let { email, password } = data;
    email = email.trim().toLowerCase();
    setIsLoading(true);
    const payload = { userData: { email, password }, path: userSigninPath };
    mutate(payload, {
      onSuccess: async () => {
        const updatedRole = getUserRoleFromToken() as Role;
        const updatedUserId = getUserIdFromToken();
        const homeId = getHomeIdFromToken();
        
        // Fetch home data and store isSalesRequired in cookie
        if (homeId) {
          try {
            const homeData = await fetchById({ id: homeId, path: homePath });
            const isSalesRequired = homeData?.home?.isSalesRequired ?? false;
            setIsSalesRequiredInCookie(isSalesRequired);
          } catch (error) {
            console.error("Error fetching home data:", error);
          }
        }
        
        const isSalesRequired = getIsSalesRequiredFromCookie() ?? false;
        const route = getInitialRoute(updatedRole, updatedUserId, isSalesRequired);
        router.push(route);
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Login Successful!"));
        setIsLoading(false);
      },
      onError: (error: any) => {
        const errMsg =
          typeof error?.response?.data?.error === "string"
            ? error.response.data.error
            : "Failed to Signin";
        handleShowPopoverMessage(errMsg);
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errMsg));
        setIsLoading(false);
      },
    });
  };
  const isPopoverVisible = useAppSelector(
    (state: { exceptionPopover: { isPopoverVisible: boolean } }) =>
      state.exceptionPopover.isPopoverVisible
  );
  const isError = useAppSelector(
    (state: { exceptionPopover: { popoverCloseOptions: boolean } }) =>
      state.exceptionPopover.popoverCloseOptions
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
  // Test for production
  return (
    <div className="min-h-screen flex flex-col font-jakarta">
      {/* ================= HEADER ================= */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/5">
        <div className="mx-auto max-w-7xl px-4 h-[88px] flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/assistly-logo.webp"
              alt="Assistly"
              width={180}
              height={58}
              className="object-contain"
              priority
            />
          </div>

          {/* Links + CTA */}
          <div className="hidden lg:flex items-center gap-10 text-[16px] text-black font-[500]">
            <a
              className="no-underline text-black hover:text-primary"
              href="https://assistly.care/"
            >
              Home
            </a>
            <a
              className="no-underline text-black hover:text-primary"
              href="https://assistly.care/products/"
            >
              Products
            </a>
            <a
              className="no-underline text-black hover:text-primary"
              href="https://assistly.care/solutions/"
            >
              Who We Serve
            </a>
            <a
              className="no-underline text-black hover:text-primary"
              href="https://assistly.care/about-us/"
            >
              About Us
            </a>
            <a
              className="no-underline text-black hover:text-primary"
              href="https://assistly.care/blog/"
            >
              Blog
            </a>

            <a
              href="https://assistly.care/request-a-demo/"
              className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold
                             bg-[#0B0B18] text-white hover:opacity-95 transition no-underline"
            >
              Request a Demo
            </a>
          </div>
        </div>
      </div>

      {/* ================= BODY + FOOTER SHARE SAME BACKGROUND ================= */}
      <div className="flex-1 flex flex-col bg-[url('/images/login-bg.webp')] bg-center bg-cover bg-no-repeat pt-[88px]">
        {/* Body content */}
        <div className="flex-1">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-10 items-start">
              {/* LEFT */}
              <div className="lg:col-span-7">
                <div className="text-[52px] leading-[1.05] font-extrabold text-[#111827] tracking-tight">
                  All Your Care Operations.
                  <br />
                  One Unified Platform.
                </div>

                <div className="mt-8">
                  <Image
                    src="/images/responsive-mockup.webp"
                    alt="Assistly platform on devices"
                    width={760}
                    height={420}
                    className="w-full max-w-[520px] h-auto drop-shadow-md"
                    priority
                  />
                </div>

                <div className="mt-10 space-y-4 text-[18px] text-gray-700">
                  <div className="flex gap-3">
                    <div className="mt-0.5 text-gray-900">✔</div>
                    <div>
                      Manage schedules, care plans, and compliance from a single
                      workspace
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 text-gray-900">✔</div>
                    <div>
                      Keep staff aligned with real-time updates and mobile-ready
                      tools
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 text-gray-900">✔</div>
                    <div>
                      Stay inspection-ready with built-in documentation and
                      audit trails
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 text-gray-900">✔</div>
                    <div>
                      Strengthen trust through clear reporting and family
                      communication
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="lg:col-span-5 md:w-full">
                <div
                  className="w-full max-w-full lg:max-w-[460px] md:w-full lg:ml-auto
                                 bg-white/90 border border-white/60 rounded-2xl shadow-xl
                                 px-8 sm:p-10"
                >
                  {currentScreen === "LOGIN" ? (
                    <LoginForm
                      onSignInButtonClick={onSignInButtonClick}
                      setCurrentScreen={setCurrentScreen}
                      isLoading={isLoading}
                    />
                  ) : currentScreen === "ACTIVATE_ACCOUNT" ? (
                    <ActivateAccount
                      activationToken={activationToken}
                      decodedEmail={decodedActivationEmail}
                      setCurrentScreen={setCurrentScreen}
                    />
                  ) : currentScreen === "FORGOT_PASSWORD" ? (
                    <ForgotPassword
                      setCurrentScreen={setCurrentScreen}
                      setEmail={setEmail}
                    />
                  ) : (
                    currentScreen === "OTP_RESET_PASSWORD" && (
                      <OTP
                        setCurrentScreen={setCurrentScreen}
                        setOtp={setOtp}
                        email={email}
                        otp={otp}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer pinned to bottom, same background */}
        <div className="pb-6">
          {/* Inset border line like screenshot */}
          <div className="mx-auto max-w-7xl px-[20px]">
            <div className="border-solid border-t-[2px] border-[#6D7BFF]/40" />
          </div>

          {/* Footer text */}
          <div className="mx-auto max-w-7xl px-6 pt-3 text-center text-sm text-gray-700">
            © Copyright 2026{" "}
            <a
              className="font-bold text-black no-underline hover:underline"
              href="https://assistly.care/"
            >
              Assistly Care LLC
            </a>{" "}
            | Powered by{" "}
            <a
              className="font-bold text-black no-underline hover:underline"
              href="https://www.charterglobal.com/"
            >
              Charter Global
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesktopLogin;

const ActivateAccount = ({
  activationToken,
  decodedEmail,
  setCurrentScreen,
}: {
  activationToken: string | null;
  decodedEmail: string;
  setCurrentScreen: (screen: Screen) => void;
}) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mutate: updateAuthMutate } = useUpdatePassword();
  const [isLoading, setIsLoading] = useState(false);

  const onActivateAccount = (data: any) => {
    setIsLoading(true);
    const { email, password, confirmPassword } = data;

    const payload: any = {
      body: {
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        token: activationToken,
      },
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
      <h2 className="text-3xl font-[500] mb-2 flex justify-center">Activate Account</h2>
      <div className="h-2" />

      <Form
        schema={activateAccountSchema}
        onSubmit={onActivateAccount}
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

      <div
        onClick={() => {
          setCurrentScreen("LOGIN");
          router.push("/");
        }}
        className="flex cursor-pointer text-primary w-fit mt-[10px] items-center gap-1"
      >
        <ArrowLeft />
        <div>Back to login</div>
      </div>
    </>
  );
};

export const LoginForm = ({ onSignInButtonClick, setCurrentScreen, isLoading }) => {
  return (
    <>
    <div className="flex flex-col items-center">
      <h1 className="text-3xl font-bold -mb-1">Login</h1>
      <p className="text-gray-500">
        Access your assistly account securely.
      </p>
      </div>
      <Form schema={loginSchema} onSubmit={onSignInButtonClick}>
        <div className="flex flex-col gap-4 w-full">
          <FormInputFieldComponent
            label={"Email"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Enter your email"
            name={"email"}
          />
          <FormInputFieldComponent
            label={"Password"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Enter your password"
            name={"password"}
            passwordVisibility={true}
          />
          {/* TODO: Implement forgot password, remember me flow */}
          <div className="flex mb-2">
            {/* <ToggleSwitch
                  onToggle={handleToggle}
                  label="Remember me"
                  start={true}
                /> */}
            <div
              className="text-primary text-sm hover:underline hover:cursor-pointer"
              onClick={() => setCurrentScreen("FORGOT_PASSWORD")}
            >
              Forgot password?
            </div>
          </div>
          <Button
            name="Sign in"
            classname="w-full bg-primary text-white"
            buttonClick={() => {}}
            isLoading={isLoading}
          />
        </div>
      </Form>
    </>
  );
};

const ForgotPassword = ({ setCurrentScreen, setEmail }) => {
  const { mutate: updateAuthMutate } = useUpdatePassword();
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const onForgotPasswordClick = (data: any) => {
    setIsLoading(true);
    let { email } = data;
    email = email.trim().toLowerCase();
    setEmail(email);
    setIsLoading(true);
    const payload = {
      body: { email: email },
      path: resetPasswordPath,
      type: "FORGOT_PASSWORD",
    };
    updateAuthMutate(payload as ResetPasswordType, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Otp sent to email!"));
        setIsLoading(false);
        setCurrentScreen("OTP_RESET_PASSWORD");
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(error?.error||error?.response?.data?.error));
        setIsLoading(false);
      },
    });
  };
  return (
    <div>
      <>
        <h2 className="text-3xl font-[500] mb-2">Forgot Your Password?</h2>
        <p className="text-gray-500 mb-6">
          Provide your email to receive a password reset OTP
        </p>
        <Form schema={forgotPasswordSchema} onSubmit={onForgotPasswordClick}>
          <FormInputFieldComponent
            label={"Email"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Enter your email"
            name={"email"}
          />
          <Button
            name="Send Email"
            classname="bg-primary text-white w-full my-[20px]"
            buttonClick={() => {}}
            isLoading={isLoading}
            type="submit"
          />
          <div
            onClick={() => {
              setCurrentScreen("LOGIN");
            }}
            className="flex cursor-pointer text-primary w-fit"
          >
            <ArrowLeft />
            <div>Back to login</div>
          </div>
        </Form>
      </>
    </div>
  );
};

export function OTP({ setCurrentScreen, setOtp, email, otp }) {
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: updateAuthMutate } = useUpdatePassword();
  const dispatch = useDispatch();
  const handleChange = (value: string) => {
    setOtp(value);
  };
  const handleValidateSubmission = (data) => {
    if (otp?.length === 6) {
      const { newPassword, confirmPassword } = data;
      setIsLoading(true);
      if (newPassword !== confirmPassword) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Passwords does not match!"));
        setIsLoading(false);
        return;
      }
      const payload = {
        body: {
          email: email,
          newPassword: newPassword,
          confirmationCode: otp,
        },
        path: confirmResetPasswordPath,
        type: "CONFIRM_RESET_PASSWORD",
      };
      updateAuthMutate(payload as ConfirmResetPasswordType, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Password Changed Succesfully!"));
          setIsLoading(false);
          setCurrentScreen("LOGIN");
        },
        onError: (error: any) => {
          const errMsg =
            typeof error?.error === "string"
              ? error.error
              : "Failed to reset Password";
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage(errMsg));
          setIsLoading(false);
        },
      });
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Enter 6 digit OTP"));
    }
  };
  const handleResendOTP = () => {
    const payload = {
      body: { email: email },
      path: resetPasswordPath,
      type: "FORGOT_PASSWORD",
    };
    updateAuthMutate(payload as ResetPasswordType, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Otp resent!"));
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(error?.response?.data?.error));
      },
    });
  };

  return (
    <div>
      <>
        <h2 className="text-3xl font-[500] mb-2">Enter OTP & Reset Password</h2>
        <p className="text-gray-500 mb-6">
          <span>
            Type the six-digit OTP sent to your email <br />& Enter new password
            and confirm to update your account
          </span>
        </p>
        <ReactCodeInput
          type="number"
          fields={6}
          value={""}
          onChange={handleChange}
          className="custom-otp-input" // custom CSS class
          inputStyle={{
            width: "50px",
            height: "50px",
            margin: "5px 5px",
            borderRadius: "8px",
            border: "2px solid #4f46e5",
            textAlign: "center" as const,
            fontSize: "18px",
            fontWeight: "bold",
            color: "#757575",
            transition: "all 0.2s ease-in-out",
            backgroundColor: "#ffffff",
          }}
          name={""}
          inputMode={"email"}
        />
        <Form schema={resetSchema} onSubmit={handleValidateSubmission}>
          <div className="flex flex-col gap-4 w-full">
            <FormInputFieldComponent
              label={"New Password"}
              className="w-full"
              SubcontainerClass="!max-w-full"
              placeholder="Enter your new password"
              name={"newPassword"}
              passwordVisibility={true}
            />
            <FormInputFieldComponent
              label={"Confirm Password"}
              className="w-full"
              SubcontainerClass="!max-w-full"
              placeholder="Confirm your password"
              name={"confirmPassword"}
              passwordVisibility={true}
            />
            <Button
              name="Submit"
              classname="w-full bg-primary text-white"
              buttonClick={() => {}}
              isLoading={isLoading}
            />
          </div>
        </Form>
        <div className="flex justify-between pt-[10px]">
          <div
            onClick={() => {
              setCurrentScreen("LOGIN");
            }}
            className="flex cursor-pointer text-primary"
          >
            <ArrowLeft />
            <div>Back to login</div>
          </div>
          <div
            onClick={handleResendOTP}
            className={`w-fit flex cursor-pointer text-primary underline text-disabled `}
          >
            <div>Resend OTP</div>
          </div>
        </div>
      </>
    </div>
  );
}
