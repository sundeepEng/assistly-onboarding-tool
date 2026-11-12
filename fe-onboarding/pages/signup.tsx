import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Button from "../commonComponents/button";
import ExceptionPopover from "../commonComponents/exception-popover";
import Form from "../commonComponents/form";
import FormInputFieldComponent from "../commonComponents/form-input-field-component";
import { signupSchema } from "../model/crm/user.model";
import { useAppSelector } from "../redux/hooks";
import {
  handleClosePopover,
  handleHideCloseOptions,
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import useCreateHome from "../services/create-home";
import { checkAndCleanExpiredTokens, clearAuthCookies } from "../utils/auth";

const Signup: NextPage = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mutate } = useCreateHome();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

  const onLogout = () => {
    clearAuthCookies();
    router.replace("/");
  };

  useEffect(() => {
    const loggedIn = checkAndCleanExpiredTokens();
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      router.replace("/onboarding");
    }
  }, [router]);

  const onSubmit = (data: any) => {
    setIsLoading(true);
    const payload = {
      user: {
        role: "PCHO",
        firstName: data.user.firstName,
        ...(data.user.middleName ? { middleName: data.user.middleName } : {}),
        lastName: data.user.lastName,
        email: data.user.email.trim().toLowerCase(),
        mobile: data.user.mobile,
      },
      home: {
        homeType: data.home.homeType,
        homeName: data.home.homeName,
        homeCapacity: Number(data.home.homeCapacity),
        homeAddress: {
          street: data.home.homeAddress.street,
          city: data.home.homeAddress.city,
          state: data.home.homeAddress.state,
          zipCode: data.home.homeAddress.zipCode,
        },
      },
    };

    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Home created successfully!"));
        setIsLoading(false);
        setTimeout(() => router.push("/onboarding"), 1200);
      },
      onError: (error: any) => {
        const errMsg =
          typeof error?.response?.data?.error === "string"
            ? error.response.data.error
            : "Failed to create home";
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errMsg));
        setIsLoading(false);
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col font-jakarta bg-[url('/images/login-bg.webp')] bg-center bg-cover bg-no-repeat">
      {/* Header */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-white border-b border-black/10">
        <Image
          src="/images/assistly-logo.webp"
          alt="Assistly"
          width={120}
          height={40}
          className="object-contain"
          priority
        />
        {isLoggedIn ? (
          <button
            onClick={onLogout}
            className="text-sm font-medium text-gray-600 hover:text-primary transition"
          >
            Log out
          </button>
        ) : (
          <button
            onClick={() => router.push("/")}
            className="text-sm font-medium text-gray-600 hover:text-primary transition"
          >
            Back to login
          </button>
        )}
      </header>

      <div className="flex-1 flex justify-center px-4 py-10 overflow-y-auto">
        <div className="w-full max-w-[720px] h-fit bg-white/90 border border-white/60 rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-[#111827]">
            Set up your account
          </h1>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            Tell us about yourself and your home to get started.
          </p>

          <Form schema={signupSchema} onSubmit={onSubmit}>
            {/* Your details */}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Your details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <FormInputFieldComponent
                label="First name"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="John"
                name="user.firstName"
              />
              <FormInputFieldComponent
                label="Last name"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="Doe"
                name="user.lastName"
              />
              <FormInputFieldComponent
                label="Email"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="johndoe@gmail.com"
                name="user.email"
              />
              <FormInputFieldComponent
                label="Mobile"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="1234567890"
                name="user.mobile"
              />
            </div>

            {/* Home details */}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Home details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <FormInputFieldComponent
                label="Home type"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="Personal Care Home"
                name="home.homeType"
              />
              <FormInputFieldComponent
                label="Home name"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="THE NEW LOVELY HOME"
                name="home.homeName"
              />
              <FormInputFieldComponent
                label="Capacity"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="10"
                name="home.homeCapacity"
              />
              <FormInputFieldComponent
                label="Street"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="1813 SW 96th AVE"
                name="home.homeAddress.street"
              />
              <FormInputFieldComponent
                label="City"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="Miramar"
                name="home.homeAddress.city"
              />
              <FormInputFieldComponent
                label="State"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="FL"
                name="home.homeAddress.state"
              />
              <FormInputFieldComponent
                label="Zip code"
                className="w-full"
                SubcontainerClass="!max-w-full"
                placeholder="33025"
                name="home.homeAddress.zipCode"
              />
            </div>

            <Button
              name="Create account"
              classname="w-full bg-primary text-white"
              buttonClick={() => {}}
              isLoading={isLoading}
            />
          </Form>
        </div>
      </div>

      {isPopoverVisible && <ExceptionPopover />}
    </div>
  );
};

export default Signup;
