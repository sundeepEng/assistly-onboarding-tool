import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { fetchStripeOnboardingLink } from "../../services/stripe-onboarding-link";
import { useCookieListener } from "../../utils/auth";
import { ACCESS_TOKEN, ID_TOKEN, USER_ID } from "../../utils/constants";

export default function StripeOnboardPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const isValidSession = useCookieListener([ID_TOKEN, ACCESS_TOKEN, USER_ID]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!isValidSession) {
      router.replace("/login");
    }
  }, [isValidSession, router]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!isValidSession) return;

    const emailParam = router.query.email;
    const email =
      typeof emailParam === "string" ? emailParam.trim().toLowerCase() : "";

    const run = async () => {
      try {
        if (!email) {
          setError("Missing email. Please use the link from your email.");
          return;
        }

        const data = await fetchStripeOnboardingLink({ email });

        if (!data?.url) {
          setError("Stripe onboarding link not found.");
          return;
        }

        window.location.assign(data.url);
      } catch (e: any) {
        const message =
          typeof e?.response?.data?.message === "string"
            ? e.response.data.message
            : e?.message || "Failed to start Stripe onboarding.";
        setError(message);
      }
    };

    run();
  }, [router.isReady, router.query.email, isValidSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <h1 className="m-0 text-xl font-bold text-gray-900">
          Redirecting to Stripe…
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We’re taking you to Stripe to finish your payout setup.
        </p>

        {!error ? (
          <p className="mt-5 text-sm text-gray-900">Loading…</p>
        ) : (
          <>
            <p className="mt-5 text-sm text-red-600">{error}</p>
            <button
              className="mt-3 w-full rounded-xl bg-secondarymirage px-3 py-2.5 text-sm text-white hover:bg-gray-800"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
