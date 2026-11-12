import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Button from "../../commonComponents/button";
import Form from "../../commonComponents/form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import { loginSchema } from "../../model/crm/user.model";
import { useAppSelector } from "../../redux/hooks";
import {
  handleClosePopover,
  handleHideCloseOptions,
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import useAuthenticateUser from "../../services/authenticate-user";
import {
  checkAndCleanExpiredTokens,
  clearAuthCookies,
  getUserEmailFromToken,
} from "../../utils/auth";
import { userSigninPath } from "../../utils/constants";

export const LoginCard = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { mutate } = useAuthenticateUser();
  const [isLoading, setIsLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setLoggedIn(checkAndCleanExpiredTokens());
    setEmail(getUserEmailFromToken());
  }, []);

  const onSignInButtonClick = (data: any) => {
    let { email, password } = data;
    email = email.trim().toLowerCase();
    setIsLoading(true);
    const payload = { userData: { email, password }, path: userSigninPath };
    mutate(payload, {
      onSuccess: () => {
        setEmail(getUserEmailFromToken());
        setLoggedIn(true);
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Login Successful!"));
        setIsLoading(false);
        router.push("/onboarding");
      },
      onError: (error: any) => {
        const errMsg =
          typeof error?.response?.data?.error === "string"
            ? error.response.data.error
            : "Failed to Signin";
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errMsg));
        setIsLoading(false);
      },
    });
  };

  const onLogout = () => {
    clearAuthCookies();
    setLoggedIn(false);
    setEmail(null);
    dispatch(handleOpenPopover());
    dispatch(handleShowPopoverMessage("Logged out successfully!"));
  };

  if (loggedIn) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-gray-500">
          You are logged in{email ? ` as ${email}` : ""}.
        </p>
        <Button
          name="Continue to onboarding"
          classname="w-full bg-primary text-white"
          buttonClick={() => router.push("/onboarding")}
          isLoading={false}
        />
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 hover:text-primary transition"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-bold -mb-1">Login</h1>
        <p className="text-gray-500">Access your assistly account securely.</p>
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

const DesktopLogin: NextPage = () => {
  const dispatch = useDispatch();
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
                  <LoginCard />
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
};

export default DesktopLogin;
