import { useEffect } from "react";
import { useRouter } from "next/router";
import { useCookieListener, getUserIdFromToken } from "../../utils/auth";
import {
  ACCESS_TOKEN,
  ID_TOKEN,
  USER_ID,
  UserPath,
  StripeStatus,
} from "../../utils/constants";
import useGetById from "../../services/getById";

type StripeStatusType = typeof StripeStatus[keyof typeof StripeStatus];

export default function StripeReturnPage() {
  const router = useRouter();
  const isValidSession = useCookieListener([ID_TOKEN, ACCESS_TOKEN, USER_ID]);

  const userId = getUserIdFromToken();

  const {
    data: userData,
    isLoading,
    error,
    refetch,
  } = useGetById({
    key: "user",
    payload: {
      id: userId,
      path: UserPath,
      enabled: !!userId && isValidSession && router.isReady,
    },
  });

  useEffect(() => {
    if (!router.isReady) return;
    if (!isValidSession) {
      router.replace("/login");
    }
  }, [router, router.isReady, isValidSession]);

  useEffect(() => {
    if (!router.isReady || !isValidSession || !userId) return;
    if (status === "ACTIVE") return;

    const interval = window.setInterval(() => {
      refetch?.();
    }, 8000);

    const stopTimer = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 60000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stopTimer);
    };
  }, [router.isReady, isValidSession, userId, refetch]);

  const emailParam = router.query.email;
  const email =
    typeof emailParam === "string" ? emailParam.trim().toLowerCase() : "";

  const continueSetup = () => {
    router.push(`/stripe/onboard?email=${encodeURIComponent(email)}`);
  };

  const status: StripeStatusType =
    (userData?.stripeOnboardingStatus as StripeStatusType) ||
    (userData?.stripeAccountId ? StripeStatus.IN_PROGRESS : StripeStatus.NOT_STARTED);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-[640px] rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <h1 className="m-0 text-xl font-bold text-gray-900">
          Stripe Setup Status
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We’ll keep this updated as Stripe processes your information.
        </p>

        {isLoading ? (
          <p className="mt-5 text-sm text-gray-900">Checking status…</p>
        ) : error ? (
          <>
            <p className="mt-5 text-sm text-red-600">
              {typeof (error as any)?.message === "string"
                ? (error as any).message
                : "Failed to fetch status."}
            </p>
            <button
              className="mt-3 w-full rounded-xl bg-secondarymirage px-3 py-2.5 text-sm text-white hover:bg-gray-800"
              onClick={() => refetch?.()}
            >
              Retry
            </button>
          </>
        ) : (
          <div className="mt-4">
            {status === StripeStatus.ACTIVE && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                You’re all set! Your payouts are enabled.
              </div>
            )}

            {status === StripeStatus.UNDER_REVIEW && (
              <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Stripe is verifying your details. You can close this tab and
                check back later.
              </div>
            )}

            {status === StripeStatus.IN_PROGRESS && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                More information is needed to complete your payout setup.
              </div>
            )}

            {status === StripeStatus.RESTRICTED && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                Your Stripe account is restricted. Please review and complete
                the required items.
              </div>
            )}

            {status === StripeStatus.NOT_STARTED && (
              <div className="mt-4 rounded-xl bg-gray-100 p-3 text-sm text-gray-900">
                Stripe setup hasn’t started yet.
              </div>
            )}

            {(status === StripeStatus.IN_PROGRESS ||
              status === StripeStatus.NOT_STARTED ||
              status === StripeStatus.RESTRICTED) && (
                <button
                  className="mt-3 w-full rounded-xl bg-secondarymirage px-3 py-2.5 text-sm text-white hover:bg-gray-800 cursor-pointer"
                  onClick={continueSetup}
                >
                  Continue Stripe Setup
                </button>
              )}

            <button
              className="mt-2.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 hover:bg-gray-50 cursor-pointer"
              onClick={() => refetch?.()}
            >
              Refresh Status
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
